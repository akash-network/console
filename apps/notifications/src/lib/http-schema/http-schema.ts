import type { ZodArray, ZodObject, ZodRawShape, ZodTypeAny } from "zod";
import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().min(0),
  limit: z.number().min(0).max(1000),
  total: z.number().min(0),
  totalPages: z.number().min(0),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean()
});

export const toPaginatedResponse = <T extends ZodTypeAny>(schema: T): ZodObject<{ data: ZodArray<T>; pagination: typeof paginationSchema }> =>
  z.object({ data: z.array(schema), pagination: paginationSchema });

export const paginationQuerySchema = z.object({
  page: z.number({ coerce: true }).optional(),
  limit: z.number({ coerce: true }).optional()
});

export function toPaginatedQuery(): typeof paginationQuerySchema;
export function toPaginatedQuery<T extends ZodRawShape>(schema: T): z.ZodIntersection<z.ZodObject<T>, typeof paginationQuerySchema>;
export function toPaginatedQuery<T extends ZodRawShape>(
  schema?: T
): typeof paginationQuerySchema | z.ZodIntersection<z.ZodObject<T>, typeof paginationQuerySchema> {
  return schema ? z.intersection(z.object(schema), paginationQuerySchema) : paginationQuerySchema;
}
