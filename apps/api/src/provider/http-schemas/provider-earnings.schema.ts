import { z } from "zod";

import { openApiExampleProviderAddress } from "@src/utils/constants";

const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
const DateSchema = z
  .string()
  .refine(val => dateFormat.test(val), { message: "Invalid date, must be in the following format: YYYY-MM-DD" })
  .transform(val => new Date(val))
  .refine(val => val instanceof Date && !isNaN(val.getTime()), { message: "Invalid date value" })
  .openapi({ format: "YYYY-MM-DD" });

export const ProviderEarningsParamsSchema = z.object({
  owner: z.string().openapi({
    description: "Provider Address",
    example: openApiExampleProviderAddress
  })
});

export const ProviderEarningsQuerySchema = z.object({
  from: DateSchema.openapi({
    description: "Start date in YYYY-MM-DD format",
    example: "2023-01-01"
  }),
  to: DateSchema.openapi({
    description: "End date in YYYY-MM-DD format",
    example: "2023-02-01"
  })
});

export const ProviderEarningsResponseSchema = z.object({
  // Add your response schema here based on what data you want to return
  // This is just an example structure
  earnings: z.object({
    totalUAktEarned: z.number(),
    totalUUsdcEarned: z.number(),
    totalUUsdEarned: z.number()
  })
});

export type ProviderEarningsParams = z.infer<typeof ProviderEarningsParamsSchema>;
export type ProviderEarningsQuery = z.infer<typeof ProviderEarningsQuerySchema>;
export type ProviderEarningsResponse = z.infer<typeof ProviderEarningsResponseSchema>;
