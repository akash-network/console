import { z } from "@hono/zod-openapi";

const SinkPeriodSchema = z.object({
  date: z.string(),
  mintedUakt: z.number(),
  dailyMintedUakt: z.number(),
  mintedTransfers: z.number(),
  dailyMintedTransfers: z.number(),
  pendingUakt: z.number(),
  pendingTransfers: z.number(),
  voidedUakt: z.number(),
  voidedTransfers: z.number(),
  refundPendingUakt: z.number(),
  refundPendingTransfers: z.number(),
  refundedUakt: z.number(),
  refundedTransfers: z.number(),
  uniqueSenders: z.number(),
  medianSecondsToMint: z.number().nullable()
});

export type SinkPeriodData = z.infer<typeof SinkPeriodSchema>;

export const SinkDashboardDataResponseSchema = z.object({
  now: SinkPeriodSchema,
  compare: SinkPeriodSchema
});

export type SinkDashboardDataResponse = z.infer<typeof SinkDashboardDataResponseSchema>;
