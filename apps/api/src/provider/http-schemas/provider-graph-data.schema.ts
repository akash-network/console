import { z } from "zod";

export const authorizedDataNames = ["count", "cpu", "gpu", "memory", "storage"];

export const ProviderGraphDataParamsSchema = z.object({
  dataName: z.string().openapi({ example: "cpu", enum: authorizedDataNames })
});

export const ProviderGraphDataResponseSchema = z.object({
  currentValue: z.number(),
  compareValue: z.number(),
  snapshots: z.array(
    z.object({
      date: z.date().openapi({ example: "2021-07-01T00:00:00.000Z" }),
      value: z.number().openapi({ example: 100 })
    })
  ),
  now: z
    .object({
      count: z.number().openapi({ example: 100 }),
      cpu: z.number().openapi({ example: 100 }),
      gpu: z.number().openapi({ example: 100 }),
      memory: z.number().openapi({ example: 100 }),
      storage: z.number().openapi({ example: 100 })
    })
    .optional(),
  compare: z
    .object({
      count: z.number().openapi({ example: 100 }),
      cpu: z.number().openapi({ example: 100 }),
      gpu: z.number().openapi({ example: 100 }),
      memory: z.number().openapi({ example: 100 }),
      storage: z.number().openapi({ example: 100 })
    })
    .optional()
});

export type ProviderGraphDataParams = z.infer<typeof ProviderGraphDataParamsSchema>;

export type ProviderGraphDataResponse = z.infer<typeof ProviderGraphDataResponseSchema>;
