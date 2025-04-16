import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult, PreviewData } from "next/types";
import type { ParsedUrlQuery } from "querystring";
import type { z } from "zod";

type ContextParamsSchema = z.ZodObject<Record<string, z.ZodString | z.ZodNumber | z.ZodOptional<z.ZodString> | z.ZodOptional<z.ZodNumber>>>;

type ContextSchema = z.ZodObject<{ params?: ContextParamsSchema; query?: ContextParamsSchema }>;

export const getValidatedServerSideProps = <
  Props extends Record<string, any>,
  Schema extends ContextSchema = ContextSchema,
  Context extends ValidatedServerSideContext<Schema> = ValidatedServerSideContext<Schema>
>(
  schema: Schema,
  handler: (context: Context) => Promise<GetServerSidePropsResult<Props>>
): GetServerSideProps<Props, ParsedUrlQuery, PreviewData> => {
  return context => {
    const validated = schema.parse(context);

    return handler({ ...context, ...validated } as Context);
  };
};

export type ValidatedServerSideContext<Schema extends ContextSchema = ContextSchema> = Omit<GetServerSidePropsContext, "params" | "query"> & z.infer<Schema>;
