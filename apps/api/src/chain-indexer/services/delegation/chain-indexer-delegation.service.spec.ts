import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ChainIndexerConfig } from "@src/chain-indexer/config/env.config";
import { ChainIndexerDelegationService } from "@src/chain-indexer/services/delegation/chain-indexer-delegation.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";

describe(ChainIndexerDelegationService.name, () => {
  it("delegates an endpoint when its flag is on and chain-indexer is configured", () => {
    const { service } = setup({ baseUrl: "https://chain-indexer.test", flagsOn: true });

    expect(service.isEnabled("addressTransactions")).toBe(true);
  });

  it("keeps serving from the legacy indexer when the flag is off", () => {
    const { service } = setup({ baseUrl: "https://chain-indexer.test", flagsOn: false });

    expect(service.isEnabled("addressTransactions")).toBe(false);
  });

  it("never delegates without a chain-indexer url, whatever the flag says", () => {
    const { service, featureFlags } = setup({ baseUrl: undefined, flagsOn: true });

    expect(service.isEnabled("dashboardStats")).toBe(false);
    expect(featureFlags.isEnabled).not.toHaveBeenCalled();
  });

  it("asks the flag service for the endpoint's own flag", () => {
    const { service, featureFlags } = setup({ baseUrl: "https://chain-indexer.test", flagsOn: true });

    service.isEnabled("dashboardStats");

    expect(featureFlags.isEnabled).toHaveBeenCalledWith(FeatureFlags.CHAIN_INDEXER_DASHBOARD_STATS);
  });

  function setup(input: { baseUrl: string | undefined; flagsOn: boolean }) {
    const config: ChainIndexerConfig = { CHAIN_INDEXER_API_BASE_URL: input.baseUrl };
    const featureFlags = mock<FeatureFlagsService>({ isEnabled: vi.fn(() => input.flagsOn) });
    const service = new ChainIndexerDelegationService(config, featureFlags);
    return { service, featureFlags };
  }
});
