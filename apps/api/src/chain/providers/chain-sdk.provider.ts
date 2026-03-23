import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { createChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { CORE_CONFIG } from "@src/core";

export const CHAIN_SDK = Symbol("CHAIN_SDK") as InjectionToken<ChainNodeWebSDK>;
export type ChainSDK = ChainNodeWebSDK;

container.register(CHAIN_SDK, {
  useFactory: instancePerContainerCachingFactory(c => {
    const { REST_API_NODE_URL } = c.resolve(CORE_CONFIG);
    return createChainNodeWebSDK({
      query: {
        baseUrl: REST_API_NODE_URL
      }
    });
  })
});
