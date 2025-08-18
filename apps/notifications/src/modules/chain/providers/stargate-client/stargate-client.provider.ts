import { StargateClient } from "@cosmjs/stargate";
import type { Provider } from "@nestjs/common";

import { RpcUrlResolverService } from "@src/modules/chain/services/rpc-url-resolver/rpc-url-resolver.service";

export const createStargateClientFactory =
  (Client: typeof StargateClient) =>
  async (rpcUrlResolver: RpcUrlResolverService): Promise<StargateClient> => {
    return await Client.connect(await rpcUrlResolver.getRpcUrl());
  };

export const StargateClientProvider: Provider<StargateClient> = {
  provide: StargateClient,
  useFactory: createStargateClientFactory(StargateClient),
  inject: [RpcUrlResolverService]
};
