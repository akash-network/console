import { ProviderVerificationQueryClient } from "@akashnetwork/provider-verification";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { CHAIN_SDK } from "./chain-sdk.provider";

export const PROVIDER_VERIFICATION_QUERY_CLIENT = Symbol("PROVIDER_VERIFICATION_QUERY_CLIENT") as InjectionToken<ProviderVerificationQueryClient>;

container.register(PROVIDER_VERIFICATION_QUERY_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const sdk = c.resolve(CHAIN_SDK);
    return new ProviderVerificationQueryClient(sdk.akash.verification.v1, sdk.akash.provider.v1beta4);
  })
});
