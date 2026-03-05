import { z } from "@hono/zod-openapi";

import { openApiExampleAddress } from "@src/utils/constants";
import { DseqSchema } from "@src/utils/schema";

export const LeasesDurationParamsSchema = z.object({
  owner: z.string().openapi({ example: openApiExampleAddress })
});

const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
const DateSchema = z
  .string()
  .refine(val => dateFormat.test(val), { message: "Invalid date, must be in the following format: YYYY-MM-DD" })
  .transform(val => new Date(val))
  .refine(val => val instanceof Date && !isNaN(val.getTime()), { message: "Invalid date value" })
  .openapi({ format: "YYYY-MM-DD" });

export const LeasesDurationQuerySchema = z
  .object({
    dseq: DseqSchema.optional(),
    startDate: DateSchema.optional().default("2000-01-01"),
    endDate: DateSchema.optional().default("2100-01-01")
  })
  .refine(
    data => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.endDate) >= new Date(data.startDate);
    },
    {
      message: "endDate must be greater than startDate",
      path: ["endDate"]
    }
  );

export const LeasesDurationResponseSchema = z.object({
  leaseCount: z.number(),
  totalDurationInSeconds: z.number(),
  totalDurationInHours: z.number(),
  leases: z.array(
    z.object({
      dseq: DseqSchema,
      oseq: z.number(),
      gseq: z.number(),
      provider: z.string(),
      startHeight: z.number(),
      startDate: z.string(),
      closedHeight: z.number(),
      closedDate: z.string(),
      durationInBlocks: z.number(),
      durationInSeconds: z.number(),
      durationInHours: z.number()
    })
  )
});

export type LeasesDurationParams = z.infer<typeof LeasesDurationParamsSchema>;
export type LeasesDurationQuery = z.infer<typeof LeasesDurationQuerySchema>;
export type LeasesDurationResponse = z.infer<typeof LeasesDurationResponseSchema>;
