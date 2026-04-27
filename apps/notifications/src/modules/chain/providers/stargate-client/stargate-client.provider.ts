import { StargateClient } from "@cosmjs/stargate";
import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { backOff } from "exponential-backoff";

import { Logger } from "@src/common/providers/logger.provider";
import type { ChainEventsConfig } from "@src/modules/chain/config";

export const createStargateClientFactory =
  (Client: typeof StargateClient) =>
  async (config: ConfigService<ChainEventsConfig>): Promise<StargateClient> => {
    const logger = new Logger({ context: "StargateClientProvider" });
    return await backOff(() => Client.connect(config.getOrThrow("chain.RPC_NODE_ENDPOINT")), {
      numOfAttempts: 15,
      maxDelay: 30_000,
      startingDelay: 500,
      timeMultiple: 2,
      jitter: "none",
      retry: (error, attempt) => {
        logger.debug({ event: "RPC_CONNECT_RETRY", attempt, error });
        return true;
      }
    });
  };

export const StargateClientProvider: Provider<StargateClient> = {
  provide: StargateClient,
  useFactory: createStargateClientFactory(StargateClient),
  inject: [ConfigService]
};
