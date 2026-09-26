import { inject, singleton } from "tsyringe";

import type { ChainIndexerConfig } from "@src/chain-indexer/config/env.config";
import { CHAIN_INDEXER_CONFIG } from "@src/chain-indexer/providers/chain-indexer-config.provider";
import { FeatureFlags, type FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";

export type DelegatedEndpoint = "addressTransactions" | "dashboardStats";

const FLAG_BY_ENDPOINT: Record<DelegatedEndpoint, FeatureFlagValue> = {
  addressTransactions: FeatureFlags.CHAIN_INDEXER_ADDRESS_TRANSACTIONS,
  dashboardStats: FeatureFlags.CHAIN_INDEXER_DASHBOARD_STATS
};

/** One flag per endpoint so a cutover is a flag flip and a rollback is the same flip back, with the legacy path always available. */
@singleton()
export class ChainIndexerDelegationService {
  readonly #config: ChainIndexerConfig;
  readonly #featureFlags: FeatureFlagsService;

  constructor(@inject(CHAIN_INDEXER_CONFIG) config: ChainIndexerConfig, @inject(FeatureFlagsService) featureFlags: FeatureFlagsService) {
    this.#config = config;
    this.#featureFlags = featureFlags;
  }

  isEnabled(endpoint: DelegatedEndpoint): boolean {
    if (!this.#config.CHAIN_INDEXER_API_BASE_URL) return false;
    return this.#featureFlags.isEnabled(FLAG_BY_ENDPOINT[endpoint]);
  }
}
