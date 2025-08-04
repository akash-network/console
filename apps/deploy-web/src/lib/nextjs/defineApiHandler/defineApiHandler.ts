import { wrapApiHandlerWithSentry } from "@sentry/nextjs";
import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import type { z } from "zod";

import { services } from "@src/services/app-di-container/server-di-container.service";
import { createRequestExecutionContext, requestExecutionContext } from "../requestExecutionContext";

/** @internal use for testing only */
export const REQ_SERVICES_KEY = Symbol("REQ_SERVICES_KEY");
export type NextApiRequestWithServices = NextApiRequest & { [REQ_SERVICES_KEY]: typeof services };

export function defineApiHandler<TResponse, TSchema extends z.ZodSchema<any> | undefined>(
  options: ApiHandlerOptions<TResponse, TSchema>
): NextApiHandler<TResponse> {
  return wrapApiHandlerWithSentry(
    (async (req, res) => {
      const context: ApiHandlerContext<TResponse, TSchema> = {
        req,
        res,
        services: (req as NextApiRequestWithServices)[REQ_SERVICES_KEY] || services,
        query: req.query as ApiHandlerContext<TResponse, TSchema>["query"],
        body: req.body as ApiHandlerContext<TResponse, TSchema>["body"]
      };

      if (options.schema) {
        const validatedContext = options.schema.safeParse(context);
        if (!validatedContext.success) {
          context.services.logger.warn({ error: validatedContext.error, event: "INVALID_API_REQUEST" });
          res.status(400);
          res.json({
            errors: validatedContext.error.errors.map(error => ({
              message: error.message,
              path: error.path
            }))
          } as TResponse);
          return;
        }

        context.query = validatedContext.data.query ?? context.query;
        context.body = validatedContext.data.body ?? context.body;
      }

      return await requestExecutionContext.run(createRequestExecutionContext(req), async () => await options.handler(context));
    }) satisfies NextApiHandler<TResponse>,
    options.route
  );
}

export interface ApiHandlerOptions<TResponse, TSchema extends z.ZodSchema<any> | undefined> {
  /**
   * The parametrized route of the API handler.
   */
  route: string;
  schema?: TSchema;
  handler(context: ApiHandlerContext<TResponse, TSchema>): Promise<void> | void;
}

export interface ApiHandlerContext<TResponse, TSchema extends z.ZodSchema<any> | undefined> {
  req: NextApiRequest;
  res: NextApiResponse<TResponse>;
  services: typeof services;
  query: TSchema extends z.ZodSchema<any> ? z.infer<TSchema>["query"] : NextApiRequest["query"];
  body: TSchema extends z.ZodSchema<any> ? z.infer<TSchema>["body"] : NextApiRequest["body"];
}
