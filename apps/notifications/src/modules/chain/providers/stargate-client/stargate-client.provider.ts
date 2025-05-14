import { StargateClient } from "@cosmjs/stargate";
import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { ChainEventsConfig } from "@src/modules/chain/config";

export const createStargateClientFactory =
  (Client: typeof StargateClient) =>
  async (config: ConfigService<ChainEventsConfig>): Promise<StargateClient> => {
    return await Client.connect(config.getOrThrow("chain.RPC_NODE_ENDPOINT"));
  };

export const StargateClientProvider: Provider<StargateClient> = {
  provide: StargateClient,
  useFactory: createStargateClientFactory(StargateClient),
  inject: [ConfigService]
};
