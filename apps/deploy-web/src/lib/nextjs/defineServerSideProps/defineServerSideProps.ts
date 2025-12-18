import { isHttpError } from "@akashnetwork/http-sdk";
import { wrapGetServerSidePropsWithSentry } from "@sentry/nextjs";
import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult, PreviewData } from "next";
import type { ParsedUrlQuery } from "querystring";
import type { z } from "zod";

import type { Session } from "@src/lib/auth0";
import { services } from "@src/services/app-di-container/server-di-container.service";
import { createRequestExecutionContext, requestExecutionContext } from "../requestExecutionContext";

export interface WrapServerSideOptions<TSchema extends z.ZodSchema<any> | undefined, TProps, TParams extends ParsedUrlQuery, TPreviewData extends PreviewData> {
  /**
   * The route of the page.
   * This is used to identify the page in Sentry.
   */
  route: string;
  schema?: TSchema;
  if?: (
    context: AppTypedContext<TSchema, TParams, TPreviewData>
  ) => boolean | Promise<boolean> | GetServerSidePropsResult<any> | Promise<GetServerSidePropsResult<any>>;
  handler?: (context: AppTypedContext<TSchema, TParams, TPreviewData>) => Promise<TProps> | TProps;
}

export type AppTypedContext<
  TSchema extends z.ZodSchema<any> | undefined = undefined,
  TParams extends ParsedUrlQuery = ParsedUrlQuery,
  TPreviewData extends PreviewData = PreviewData
> = TypedContext<TSchema, TParams, TPreviewData> & {
  services: typeof services;
  session?: Session | null;
};
type TypedContext<TSchema extends z.ZodSchema<any> | undefined, TParams extends ParsedUrlQuery, TPreviewData extends PreviewData> =
  TSchema extends z.ZodSchema<any>
    ? Omit<GetServerSidePropsContext<TParams, TPreviewData>, "params" | "query"> & {
        params: "params" extends keyof z.infer<TSchema> ? z.infer<TSchema>["params"] : never;
        query: "query" extends keyof z.infer<TSchema> ? z.infer<TSchema>["query"] : never;
      }
    : GetServerSidePropsContext<TParams, TPreviewData>;

const NOT_FOUND: GetServerSidePropsResult<any> = {
  notFound: true
};

export function defineServerSideProps<
  TProps extends Record<string, any>,
  TSchema extends z.ZodSchema<any> | undefined = undefined,
  TPreviewData extends PreviewData = PreviewData,
  TParams extends ParsedUrlQuery = ParsedUrlQuery
>(options: WrapServerSideOptions<TSchema, TProps, TParams, TPreviewData>): GetServerSideProps<TProps, TParams, TPreviewData> {
  return wrapGetServerSidePropsWithSentry(async (context: GetServerSidePropsContext<TParams, TPreviewData>): Promise<GetServerSidePropsResult<TProps>> => {
    return requestExecutionContext.run(createRequestExecutionContext(context.req), async () => {
      const requestServices = "services" in context ? (context.services as typeof services) : services;

      const session = await requestServices.getSession(context.req, context.res);
      requestServices.userTracker.track(session?.user);

      const validatedContext = options.schema ? options.schema.safeParse(context) : undefined;
      if (validatedContext && !validatedContext.success) {
        requestServices.logger.warn({ message: `Invalid context for route ${options.route}`, error: validatedContext.error });
        return NOT_FOUND;
      }

      const newContext = {
        services: requestServices,
        ...context,
        ...validatedContext?.data,
        session
      } as AppTypedContext<TSchema, TParams, TPreviewData>;

      const result = await options.if?.(newContext);
      if (typeof result === "object" && result) return result;
      if (result === false) return NOT_FOUND;

      if (options.handler) {
        try {
          return await options.handler(newContext);
        } catch (error) {
          if (isHttpError(error) && (error.response?.status === 404 || error.response?.status === 400)) {
            requestServices.logger.warn({
              message: `Error in handler for route ${options.route}`,
              error
            });
            return NOT_FOUND;
          }
          throw error;
        }
      }

      return { props: {} } as any;
    });
  }, options.route);
}
