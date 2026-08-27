import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { createChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { CORE_CONFIG } from "@src/core";

/**
 * Deadline for a single chain query. Without one the SDK adds no abort signal at all, so a black-holed
 * connection hangs its caller indefinitely — a background job until pg-boss expires it a quarter of an hour
 * later, and a request until the client gives up. Matches the 30s the REST services already pass to
 * `httpClient.get`, and is a ceiling rather than a target: every query behind this token is a point read.
 */
const QUERY_TIMEOUT_MS = 30_000;

type QueryTransportOptions = NonNullable<Parameters<typeof createChainNodeWebSDK>[0]["query"]["transportOptions"]>;

const TRANSPORT_OPTIONS: QueryTransportOptions & { defaultTimeoutMs: number } = {
  defaultTimeoutMs: QUERY_TIMEOUT_MS,
  retry: {
    maxAttempts: 3
  }
};

export const CHAIN_SDK = Symbol("CHAIN_SDK") as InjectionToken<ChainNodeWebSDK>;
export type ChainSDK = ChainNodeWebSDK;

container.register(CHAIN_SDK, {
  useFactory: instancePerContainerCachingFactory(c => {
    const { REST_API_NODE_URL } = c.resolve(CORE_CONFIG);
    return createChainNodeWebSDK({
      query: {
        baseUrl: REST_API_NODE_URL,
        transportOptions: TRANSPORT_OPTIONS
      }
    });
  })
});
