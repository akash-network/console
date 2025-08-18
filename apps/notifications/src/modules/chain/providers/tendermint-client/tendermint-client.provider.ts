import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import type { Provider } from "@nestjs/common";

import { RpcUrlResolverService } from "@src/modules/chain/services/rpc-url-resolver/rpc-url-resolver.service";

export const createTendermintClientFactory =
  (Client: typeof Tendermint34Client) =>
  async (rpcUrlResolver: RpcUrlResolverService): Promise<Tendermint34Client> => {
    return await Client.connect(await rpcUrlResolver.getRpcUrl());
  };

export const TendermintClientProvider: Provider<Tendermint34Client> = {
  provide: Tendermint34Client,
  useFactory: createTendermintClientFactory(Tendermint34Client),
  inject: [RpcUrlResolverService]
};
