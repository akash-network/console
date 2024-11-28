import { GetServerSidePropsContext, GetServerSidePropsResult, PreviewData } from "next/types";
import type { ParsedUrlQuery } from "querystring";
import { z } from "zod";

export const getValidatedServerSideProps = <
  Props extends { [key: string]: any } = { [key: string]: any },
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
  Schema extends z.ZodObject<any, any, any> = z.ZodObject<{ params: z.ZodObject<any, any, any> }, any, any>
>(
  schema: Schema,
  handler: (
    context: Omit<GetServerSidePropsContext<Params, Preview>, "params"> & { params: z.infer<Schema>["params"] }
  ) => Promise<GetServerSidePropsResult<Props>>
): ((context: GetServerSidePropsContext<Params, Preview>) => Promise<GetServerSidePropsResult<Props>>) => {
  return context => {
    const { params } = schema.parse(context);
    return handler({ ...context, params });
  };
};
