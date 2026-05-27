import { createProviderSDK } from "@akashnetwork/chain-sdk";
import { inject, singleton } from "tsyringe";

import { mapClusterToStreamStatus } from "@src/lib/stream-status-mapper/stream-status-mapper";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { ChainProvider } from "@src/types/chain-provider";
import type { ClusterState } from "@src/types/inventory.types";

@singleton()
export class ProviderStreamFactory {
  readonly #logger;
  readonly #sdks = new Map<string, ReturnType<typeof createProviderSDK>>();

  constructor(@inject(LOGGER_FACTORY) loggerFactory: LoggerFactory) {
    this.#logger = loggerFactory({ context: "ProviderStreamFactory" });
  }

  async *openStatusStream(provider: ChainProvider, signal: AbortSignal): AsyncIterable<ClusterState> {
    const url = new URL(provider.hostUri);
    url.port = "8444";
    let sdk = this.#sdks.get(provider.hostUri);
    if (!sdk) {
      sdk = createProviderSDK({
        baseUrl: url.toString(),
        transportOptions: {
          pingIdleConnection: true,
          idleConnectionTimeoutMs: 60 * 1000
        }
      });
      this.#sdks.set(provider.hostUri, sdk);
    }

    const openedAt = Date.now();
    const stream = await sdk.akash.provider.v1.streamStatus({}, { signal });
    this.#logger.debug({ event: "STREAM_OPENED", owner: provider.owner, msSinceCreate: Date.now() - openedAt });

    for await (const status of stream) {
      const inventory = status.cluster?.inventory?.cluster;
      this.#logger.debug({
        event: "STREAM_RAW_ENVELOPE",
        owner: provider.owner,
        msSinceOpen: Date.now() - openedAt,
        hasInventoryCluster: !!inventory
      });
      if (inventory) {
        yield mapClusterToStreamStatus(inventory);
      }
    }
  }

  async disposeProvider(hostUri: string): Promise<void> {
    const sdk = this.#sdks.get(hostUri);
    if (sdk) {
      this.#sdks.delete(hostUri);
      await sdk[Symbol.asyncDispose]();
      this.#logger.debug({ event: "PROVIDER_SDK_DISPOSED", hostUri });
    }
  }
}
