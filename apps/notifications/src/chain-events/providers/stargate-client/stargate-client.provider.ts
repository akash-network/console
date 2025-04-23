import { StargateClient } from '@cosmjs/stargate';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { GlobalEnvConfig } from '@src/config/env.config';

export const createStargateClientFactory =
  (Client: typeof StargateClient) =>
  async (config: ConfigService<GlobalEnvConfig>): Promise<StargateClient> => {
    return await Client.connect(config.getOrThrow('RPC_NODE_ENDPOINT'));
  };

export const StargateClientProvider: Provider<StargateClient> = {
  provide: StargateClient,
  useFactory: createStargateClientFactory(StargateClient),
  inject: [ConfigService],
};
