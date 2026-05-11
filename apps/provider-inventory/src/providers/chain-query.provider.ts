import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { SelfAttribute } from "@src/types/chain-provider";

export interface ChainProviderRecord {
  owner: string;
  hostUri: string;
  createdHeight: bigint;
  attributes: SelfAttribute[];
}

export interface ChainAuditRecord {
  owner: string;
  attributes: Array<{ key: string; value: string; auditor: string }>;
}

export interface ChainQueryClient {
  getProviders(): Promise<ChainProviderRecord[]>;
  getAllProvidersAttributes(): Promise<ChainAuditRecord[]>;
}

export const CHAIN_QUERY_CLIENT: InjectionToken<ChainQueryClient> = Symbol("CHAIN_QUERY_CLIENT");

container.register(CHAIN_QUERY_CLIENT, {
  useFactory: instancePerContainerCachingFactory(
    () =>
      ({
        async getProviders() {
          return [];
        },
        async getAllProvidersAttributes() {
          return [];
        }
      }) satisfies ChainQueryClient
  )
});
