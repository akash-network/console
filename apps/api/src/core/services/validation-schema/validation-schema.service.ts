import {
  baseObjectInputType,
  baseObjectOutputType,
  objectUtil,
  z,
  ZodArray,
  ZodEffects,
  ZodObject,
  ZodPipeline,
  ZodRawShape,
  ZodString,
  ZodTypeAny
} from "zod";

export class ValidationSchemaService {
  static json<
    S extends ZodRawShape,
    T extends ZodObject<
      S,
      "strip",
      ZodTypeAny,
      { [k in keyof objectUtil.addQuestionMarks<baseObjectOutputType<S>, any>]: objectUtil.addQuestionMarks<baseObjectOutputType<S>, any>[k] },
      { [k_1 in keyof baseObjectInputType<S>]: baseObjectInputType<S>[k_1] }
    >
  >(schema: T): ZodPipeline<ZodEffects<ZodString, any, string>, T>;
  static json<I extends ZodTypeAny, T extends ZodArray<I, "many">>(schema: T): ZodPipeline<ZodEffects<ZodString, any, string>, T>;
  static json<T extends ZodTypeAny>(schema: T): ZodPipeline<ZodEffects<ZodString, any, string>, T> {
    return z
      .string()
      .transform((content, ctx) => {
        try {
          return JSON.parse(content);
        } catch (error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "invalid json"
          });
          return z.never;
        }
      })
      .pipe(schema);
  }
}
