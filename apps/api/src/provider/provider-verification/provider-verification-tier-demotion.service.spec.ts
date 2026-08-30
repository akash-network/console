import { VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { VerificationParams, VerificationProviderTierDemotion, VerificationProviderTierStream } from "@akashnetwork/database/dbSchemas/akash";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderVerificationReadinessService } from "./provider-verification-readiness.service";
import type { ProviderVerificationTierDemotionRepository } from "./provider-verification-tier-demotion.repository";
import { ProviderVerificationTierDemotionFeedSchema } from "./provider-verification-tier-demotion.schema";
import { ProviderVerificationTierDemotionService } from "./provider-verification-tier-demotion.service";

describe(ProviderVerificationTierDemotionService.name, () => {
  it("returns an ordered normalized cursor feed", async () => {
    const { service, repository } = setup();
    repository.getFeed.mockResolvedValue({
      stream: row<VerificationProviderTierStream>({ streamId: "a3d46e08-d84a-4ab5-b23c-08fc10a575f6" }),
      params: row<VerificationParams>({ params: { verification_module_active: true } }),
      headCursor: "8",
      globallyComplete: true,
      demotions: [
        row<VerificationProviderTierDemotion>({
          id: "7",
          provider: "akash1provider",
          previousEffectiveTier: VerificationTier.verification_tier_established,
          previousMaxPlacementTier: VerificationTier.verification_tier_established,
          previousSnapshotState: "current",
          currentEffectiveTier: VerificationTier.verification_tier_verified,
          currentMaxPlacementTier: VerificationTier.verification_tier_identified,
          currentSnapshotState: "stale",
          changes: ["tier_gate", "snapshot_eligibility"],
          observedHeight: 123,
          observedBlockTime: new Date("2026-08-24T12:00:00.000Z")
        })
      ]
    });

    const result = await service.getFeed("6", 50);

    expect(repository.getFeed).toHaveBeenCalledWith("6", 50);
    expect(ProviderVerificationTierDemotionFeedSchema.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      headCursor: "8",
      nextCursor: "7",
      moduleActive: true,
      items: [
        {
          cursor: "7",
          previous: { effectiveTier: "L3", maxPlacementTier: "L3", snapshotState: "current" },
          current: { effectiveTier: "L2", maxPlacementTier: "L1", snapshotState: "stale" }
        }
      ]
    });
  });

  it("returns no feed while indexer readiness or canonical global state is incomplete", async () => {
    const { service, readiness, repository } = setup({ ready: false });

    await expect(service.getFeed("0", 50)).resolves.toBeNull();
    expect(repository.getFeed).not.toHaveBeenCalled();

    readiness.isReady.mockResolvedValue(true);
    repository.getFeed.mockResolvedValue({
      stream: row<VerificationProviderTierStream>({ streamId: "a3d46e08-d84a-4ab5-b23c-08fc10a575f6" }),
      params: row<VerificationParams>({ params: { verification_module_active: true } }),
      headCursor: "0",
      globallyComplete: false,
      demotions: []
    });
    await expect(service.getFeed("0", 50)).resolves.toBeNull();
  });

  it("keeps the caller cursor when no later item exists", async () => {
    const { service, repository } = setup();
    repository.getFeed.mockResolvedValue({
      stream: row<VerificationProviderTierStream>({ streamId: "a3d46e08-d84a-4ab5-b23c-08fc10a575f6" }),
      params: row<VerificationParams>({ params: { verification_module_active: false } }),
      headCursor: "12",
      globallyComplete: true,
      demotions: []
    });

    await expect(service.getFeed("12", 50)).resolves.toMatchObject({ moduleActive: false, headCursor: "12", nextCursor: "12", items: [] });
  });
});

function setup(input: { ready?: boolean } = {}) {
  const repository = mock<ProviderVerificationTierDemotionRepository>();
  const readiness = mock<ProviderVerificationReadinessService>();
  readiness.isReady.mockResolvedValue(input.ready ?? true);
  return { repository, readiness, service: new ProviderVerificationTierDemotionService(repository, readiness) };
}

function row<T>(value: Partial<T>): T {
  return value as T;
}
