import { z } from "@hono/zod-openapi";

import { ProviderVerificationSnapshotStateSchema, ProviderVerificationTierSchema } from "./provider-verification.schema";

const UIntStringSchema = z.string().regex(/^\d+$/);

const ProviderTierStateSchema = z.object({
  effectiveTier: ProviderVerificationTierSchema,
  maxPlacementTier: ProviderVerificationTierSchema,
  snapshotState: ProviderVerificationSnapshotStateSchema
});

export const ProviderVerificationTierDemotionFeedSchema = z.object({
  streamId: z.string().uuid(),
  headCursor: UIntStringSchema,
  nextCursor: UIntStringSchema,
  moduleActive: z.boolean(),
  items: z.array(
    z.object({
      cursor: UIntStringSchema,
      provider: z.string(),
      previous: ProviderTierStateSchema,
      current: ProviderTierStateSchema,
      changes: z.array(z.enum(["tier_gate", "snapshot_eligibility"])),
      observedHeight: UIntStringSchema,
      observedAt: z.string().datetime()
    })
  )
});

export type ProviderVerificationTierDemotionFeed = z.infer<typeof ProviderVerificationTierDemotionFeedSchema>;
