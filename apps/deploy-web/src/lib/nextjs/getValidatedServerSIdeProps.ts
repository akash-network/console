import { GetServerSidePropsContext, GetServerSidePropsResult } from "next/types";
import type { ParsedUrlQuery } from "querystring";
import { z } from "zod";

type ContextParamsSchema = z.ZodObject<Record<string, z.ZodString | z.ZodNumber | z.ZodOptional<z.ZodString> | z.ZodOptional<z.ZodNumber>>>;

type ContextSchema = z.ZodObject<{ params?: ContextParamsSchema; query?: ContextParamsSchema }>;

export const getValidatedServerSideProps = <Props extends { [key: string]: any }, Schema extends ContextSchema = ContextSchema>(
  schema: Schema,
  handler: (context: Omit<GetServerSidePropsContext, "params" | "query"> & z.infer<Schema>) => Promise<GetServerSidePropsResult<Props>>
): ((context: GetServerSidePropsContext<ParsedUrlQuery>) => Promise<GetServerSidePropsResult<Props>>) => {
  return context => {
    const validated = schema.parse(context);

    return handler({ ...context, ...validated });
  };
};
