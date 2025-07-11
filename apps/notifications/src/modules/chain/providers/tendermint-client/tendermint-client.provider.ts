import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ChainEventsConfig } from "@src/modules/chain/config";

export const createTendermintClientFactory =
  (Client: typeof Tendermint34Client) =>
  async (config: ConfigService<ChainEventsConfig>): Promise<Tendermint34Client> => {
    return await Client.connect(config.getOrThrow("chain.RPC_NODE_ENDPOINT"));
  };

export const TendermintClientProvider: Provider<Tendermint34Client> = {
  provide: Tendermint34Client,
  useFactory: createTendermintClientFactory(Tendermint34Client),
  inject: [ConfigService]
};
