import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { createChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { APP_CONFIG } from "./app-config.provider";

export const CHAIN_SDK = Symbol("CHAIN_SDK") as InjectionToken<ChainNodeWebSDK>;

container.register(CHAIN_SDK, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(APP_CONFIG);
    return createChainNodeWebSDK({
      query: {
        baseUrl: config.REST_API_NODE_URL
      }
    });
  })
});
