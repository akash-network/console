import type { paths } from "@akashnetwork/console-api-types/chain-indexer";
import { operations } from "@akashnetwork/console-api-types/chain-indexer";
import { createApi, type TypedClient } from "@akashnetwork/openapi-sdk";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { CHAIN_INDEXER_CONFIG } from "@src/chain-indexer/providers/chain-indexer-config.provider";

export type ChainIndexerApiClient = TypedClient<paths, typeof operations>;

export const CHAIN_INDEXER_API_CLIENT: InjectionToken<ChainIndexerApiClient> = Symbol("CHAIN_INDEXER_API_CLIENT");

container.register(CHAIN_INDEXER_API_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c =>
    createApi<paths, typeof operations>(operations, { baseUrl: c.resolve(CHAIN_INDEXER_CONFIG).CHAIN_INDEXER_API_BASE_URL })
  )
});
