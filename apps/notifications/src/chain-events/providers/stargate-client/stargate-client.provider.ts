import { StargateClient } from '@cosmjs/stargate';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ChainEventsEnvConfig } from '@src/chain-events/config/env.config';
import type { Namespaced } from '@src/lib/types/namespaced-config.type';

export const createStargateClientFactory =
  (Client: typeof StargateClient) =>
  async (
    config: ConfigService<Namespaced<'chain-events', ChainEventsEnvConfig>>,
  ): Promise<StargateClient> => {
    return await Client.connect(
      config.getOrThrow('chain-events.RPC_NODE_ENDPOINT'),
    );
  };

export const StargateClientProvider: Provider<StargateClient> = {
  provide: StargateClient,
  useFactory: createStargateClientFactory(StargateClient),
  inject: [ConfigService],
};
