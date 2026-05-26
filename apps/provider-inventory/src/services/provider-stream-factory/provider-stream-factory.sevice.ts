import { createProviderSDK } from "@akashnetwork/chain-sdk";
import { singleton } from "tsyringe";

import { mapClusterToStreamStatus } from "@src/lib/stream-status-mapper/stream-status-mapper";
import { ChainProvider } from "@src/types/chain-provider";
import type { ClusterState } from "@src/types/inventory.types";

@singleton()
export class ProviderStreamFactory {
  async *openStatusStream(provider: ChainProvider, signal: AbortSignal): AsyncIterable<ClusterState> {
    const url = new URL(provider.hostUri);
    url.port = "8444";
    const sdk = createProviderSDK({
      baseUrl: url.toString(),
      transportOptions: {
        pingIdleConnection: true,
        idleConnectionTimeoutMs: 5 * 60 * 1000 // 5 minutes
      }
    });

    const stream = await sdk.akash.provider.v1.streamStatus({}, { signal });
    for await (const status of stream) {
      const inventory = status.cluster?.inventory?.cluster;
      if (inventory) {
        yield mapClusterToStreamStatus(inventory);
      }
    }
  }
}
