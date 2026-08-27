import { z } from "zod";

const UIntStringSchema = z.string().regex(/^\d+$/);
const TierSchema = z.enum(["L0", "L1", "L2", "L3", "L4", "unknown"]);
const SnapshotStateSchema = z.enum(["unknown", "not_posted", "current", "stale", "suspended"]);

const TierStateSchema = z.object({
  effectiveTier: TierSchema,
  maxPlacementTier: TierSchema,
  snapshotState: SnapshotStateSchema
});

export const ProviderTierDemotionFeedSchema = z.object({
  streamId: z.string().uuid(),
  headCursor: UIntStringSchema,
  nextCursor: UIntStringSchema,
  moduleActive: z.boolean(),
  items: z.array(
    z.object({
      cursor: UIntStringSchema,
      provider: z.string().min(1),
      previous: TierStateSchema,
      current: TierStateSchema,
      changes: z.array(z.enum(["tier_gate", "snapshot_eligibility"])),
      observedHeight: UIntStringSchema,
      observedAt: z.string().datetime()
    })
  )
});

export type ProviderTierDemotionFeed = z.infer<typeof ProviderTierDemotionFeedSchema>;
export type ProviderTierDemotion = ProviderTierDemotionFeed["items"][number];
