import { z } from "@hono/zod-openapi";

const SinkMigrationMilestoneKeySchema = z.enum(["announcement", "voteClosed", "upgrade"]);

export const SinkUnbondingsResponseSchema = z.object({
  summary: z.object({
    unbondingUakt: z.number().openapi({ description: "AKT still unbonding, net of cancellations" }),
    unbondingDelegators: z.number().openapi({ description: "Delegators with AKT still unbonding" }),
    senders: z.number().openapi({ description: "Addresses that sent AKT to Solana" }),
    sendersWhoUnbonded: z.number().openapi({ description: "Addresses that sent AKT to Solana and also unbonded" }),
    sentUakt: z.number().openapi({ description: "AKT sent to Solana, excluding voided, refund-pending and refunded transfers" }),
    sentBySendersWhoUnbondedUakt: z.number().openapi({ description: "AKT sent to Solana by addresses that also unbonded" })
  }),
  daily: z.array(
    z.object({
      date: z.string().openapi({ description: "UTC day, YYYY-MM-DD" }),
      unbondStartedUakt: z.number().openapi({ description: "AKT that started unbonding on this day" }),
      unbondCompletingUakt: z.number().openapi({ description: "AKT whose unbonding completes on this day, net of cancellations" }),
      cancelledUakt: z.number().openapi({ description: "AKT whose unbonding was cancelled on this day" }),
      sentToSolanaUakt: z.number().openapi({ description: "AKT sent to Solana on this day, excluding voided, refund-pending and refunded transfers" }),
      sentBySendersWhoUnbondedUakt: z.number().openapi({ description: "Part of the AKT sent to Solana on this day by addresses that also unbonded" })
    })
  ),
  milestones: z.array(
    z.object({
      key: SinkMigrationMilestoneKeySchema,
      label: z.string().openapi({ description: "Human readable name of the milestone" }),
      height: z.number().openapi({ description: "Block height of the milestone" }),
      date: z.string().nullable().openapi({ description: "Time of the milestone block, null until that block is indexed" }),
      unbondedSinceUakt: z.number().openapi({ description: "AKT that started unbonding at or after the milestone block, net of cancellations" }),
      delegatorsSince: z.number().openapi({ description: "Delegators with AKT that started unbonding at or after the milestone block, net of cancellations" })
    })
  ),
  cohorts: z.array(
    z.object({
      firstUnbondedAfter: SinkMigrationMilestoneKeySchema.nullable().openapi({
        description:
          "Last milestone reached before the delegators of this cohort first unbonded, ignoring fully cancelled unbondings, null for those who first unbonded before every milestone"
      }),
      delegators: z.number().openapi({ description: "Delegators of the cohort" }),
      unbondedUakt: z.number().openapi({ description: "AKT the cohort unbonded, net of cancellations" }),
      liquidUakt: z.number().openapi({ description: "Part of the unbonded AKT whose unbonding period is over" }),
      senders: z.number().openapi({ description: "Delegators of the cohort that sent AKT to Solana after they first unbonded" }),
      sentUakt: z
        .number()
        .openapi({ description: "AKT the cohort sent to Solana after first unbonding, excluding voided, refund-pending and refunded transfers" }),
      sentFromLiquidUakt: z.number().openapi({ description: "AKT sent to Solana, capped per delegator at its liquid unbonded AKT" })
    })
  )
});

export type SinkUnbondingsResponse = z.infer<typeof SinkUnbondingsResponseSchema>;
export type SinkUnbondingsDay = SinkUnbondingsResponse["daily"][number];
export type SinkUnbondingsMilestone = SinkUnbondingsResponse["milestones"][number];
export type SinkUnbondingsCohort = SinkUnbondingsResponse["cohorts"][number];
