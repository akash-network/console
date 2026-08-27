import { singleton } from "tsyringe";

import { mapTier } from "./provider-verification.mapper";
import { ProviderVerificationSnapshotStateSchema } from "./provider-verification.schema";
import { ProviderVerificationReadinessService } from "./provider-verification-readiness.service";
import { ProviderVerificationTierDemotionRepository } from "./provider-verification-tier-demotion.repository";
import type { ProviderVerificationTierDemotionFeed } from "./provider-verification-tier-demotion.schema";

@singleton()
export class ProviderVerificationTierDemotionService {
  constructor(
    private readonly repository: ProviderVerificationTierDemotionRepository,
    private readonly readiness: ProviderVerificationReadinessService
  ) {}

  async getFeed(after: string, limit: number): Promise<ProviderVerificationTierDemotionFeed | null> {
    if (!(await this.readiness.isReady())) return null;

    const rows = await this.repository.getFeed(after, limit);
    const moduleActive = readModuleActive(rows.params?.params);
    if (!rows.stream || !rows.globallyComplete || moduleActive === null) return null;

    const items = rows.demotions.map(row => ({
      cursor: row.id,
      provider: row.provider,
      previous: {
        effectiveTier: mapTier(row.previousEffectiveTier),
        maxPlacementTier: mapTier(row.previousMaxPlacementTier),
        snapshotState: ProviderVerificationSnapshotStateSchema.parse(row.previousSnapshotState)
      },
      current: {
        effectiveTier: mapTier(row.currentEffectiveTier),
        maxPlacementTier: mapTier(row.currentMaxPlacementTier),
        snapshotState: ProviderVerificationSnapshotStateSchema.parse(row.currentSnapshotState)
      },
      changes: row.changes.map(change => parseChange(change)),
      observedHeight: String(row.observedHeight),
      observedAt: row.observedBlockTime.toISOString()
    }));

    return {
      streamId: rows.stream.streamId,
      headCursor: rows.headCursor,
      nextCursor: items.at(-1)?.cursor ?? after,
      moduleActive,
      items
    };
  }
}

function readModuleActive(params: Record<string, unknown> | undefined): boolean | null {
  const value = params?.verification_module_active;
  return typeof value === "boolean" ? value : null;
}

function parseChange(value: string): "tier_gate" | "snapshot_eligibility" {
  if (value === "tier_gate" || value === "snapshot_eligibility") return value;
  throw new Error(`Unknown provider tier demotion change: ${value}`);
}
