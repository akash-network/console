import type { DependencyContainer, InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { ChainIndexerConfig } from "@src/chain-indexer/config/env.config";
import { envSchema } from "@src/chain-indexer/config/env.config";
import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";

export const CHAIN_INDEXER_CONFIG: InjectionToken<ChainIndexerConfig> = Symbol("CHAIN_INDEXER_CONFIG");

container.register(CHAIN_INDEXER_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});

/** Resolving the config at start-up turns a malformed url into a failed boot instead of a failing request on every route that injects the delegation service. */
export function createChainIndexerConfigInitializer(c: DependencyContainer): AppInitializer {
  return {
    async [ON_APP_START]() {
      c.resolve(CHAIN_INDEXER_CONFIG);
    }
  };
}

container.register(APP_INITIALIZER, { useFactory: instancePerContainerCachingFactory(createChainIndexerConfigInitializer) });
