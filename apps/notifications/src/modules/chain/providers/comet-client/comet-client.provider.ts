import { Comet38Client } from "@cosmjs/tendermint-rpc";
import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { backOff } from "exponential-backoff";

import { Logger } from "@src/common/providers/logger.provider";
import type { ChainEventsConfig } from "@src/modules/chain/config";

export const createCometClientFactory =
  (Client: typeof Comet38Client) =>
  async (config: ConfigService<ChainEventsConfig>): Promise<Comet38Client> => {
    const logger = new Logger({ context: "CometClientProvider" });
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

export const CometClientProvider: Provider<Comet38Client> = {
  provide: Comet38Client,
  useFactory: createCometClientFactory(Comet38Client),
  inject: [ConfigService]
};
