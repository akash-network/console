import { z } from "zod";

export const authorizedDataNames = ["count", "cpu", "gpu", "memory", "storage"];

export const ProviderGraphDataParamsSchema = z.object({
  dataName: z.string().openapi({ example: "cpu", enum: authorizedDataNames })
});

const metricsSchema = z.object(Object.fromEntries(authorizedDataNames.map(name => [name, z.number().openapi({ example: 100 })])));

export const ProviderGraphDataResponseSchema = z.object({
  currentValue: z.number(),
  compareValue: z.number(),
  snapshots: z.array(
    z.object({
      date: z.string().openapi({ example: "2021-07-01T00:00:00.000Z" }),
      value: z.number().openapi({ example: 100 })
    })
  ),
  now: metricsSchema.optional(),
  compare: metricsSchema.optional()
});

export type ProviderGraphDataParams = z.infer<typeof ProviderGraphDataParamsSchema>;

export type ProviderGraphDataResponse = z.infer<typeof ProviderGraphDataResponseSchema>;
