import { z } from "@hono/zod-openapi";

export const SinkUnbondingsResponseSchema = z.object({
  summary: z.object({
    unbondingUakt: z.number().openapi({ description: "AKT still unbonding, net of cancellations" }),
    unbondingDelegators: z.number().openapi({ description: "Delegators with AKT still unbonding" }),
    senders: z.number().openapi({ description: "Addresses that sent AKT to Solana" }),
    sendersWhoUnbonded: z.number().openapi({ description: "Addresses that sent AKT to Solana and also unbonded" }),
    sentUakt: z.number().openapi({ description: "AKT sent to Solana, excluding voided and refunded transfers" }),
    sentBySendersWhoUnbondedUakt: z.number().openapi({ description: "AKT sent to Solana by addresses that also unbonded" })
  }),
  daily: z.array(
    z.object({
      date: z.string().openapi({ description: "UTC day, YYYY-MM-DD" }),
      unbondStartedUakt: z.number().openapi({ description: "AKT that started unbonding on this day" }),
      unbondCompletingUakt: z.number().openapi({ description: "AKT whose unbonding completes on this day, net of cancellations" }),
      cancelledUakt: z.number().openapi({ description: "AKT whose unbonding was cancelled on this day" }),
      sentToSolanaUakt: z.number().openapi({ description: "AKT sent to Solana on this day, excluding voided and refunded transfers" }),
      sentBySendersWhoUnbondedUakt: z.number().openapi({ description: "Part of the AKT sent to Solana on this day by addresses that also unbonded" })
    })
  )
});

export type SinkUnbondingsResponse = z.infer<typeof SinkUnbondingsResponseSchema>;
export type SinkUnbondingsDay = SinkUnbondingsResponse["daily"][number];
