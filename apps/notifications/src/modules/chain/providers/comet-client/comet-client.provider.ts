import { Comet38Client } from "@cosmjs/tendermint-rpc";
import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ChainEventsConfig } from "@src/modules/chain/config";

export const createCometClientFactory =
  (Client: typeof Comet38Client) =>
  async (config: ConfigService<ChainEventsConfig>): Promise<Comet38Client> => {
    return await Client.connect(config.getOrThrow("chain.RPC_NODE_ENDPOINT"));
  };

export const CometClientProvider: Provider<Comet38Client> = {
  provide: Comet38Client,
  useFactory: createCometClientFactory(Comet38Client),
  inject: [ConfigService]
};
