import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { ChainIndexerConfig } from "@src/chain-indexer/config/env.config";
import { envSchema } from "@src/chain-indexer/config/env.config";
import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";

export const CHAIN_INDEXER_CONFIG: InjectionToken<ChainIndexerConfig> = Symbol("CHAIN_INDEXER_CONFIG");

container.register(CHAIN_INDEXER_CONFIG, {
  useFactory: instancePerContainerCachingFactory(c => envSchema.parse(c.resolve(RAW_APP_CONFIG)))
});
