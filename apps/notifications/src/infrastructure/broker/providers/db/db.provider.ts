import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client as PgClient } from "pg";

import type { BrokerConfig } from "@src/infrastructure/broker/config";

export const createPgClientFactory =
  (Client: typeof PgClient) =>
  async (config: ConfigService<BrokerConfig>): Promise<PgClient> => {
    const client = new Client(config.getOrThrow("broker.EVENT_BROKER_POSTGRES_URI"));
    await client.connect();

    return client;
  };

export const DbProvider: Provider<PgClient> = {
  provide: PgClient,
  inject: [ConfigService],
  useFactory: createPgClientFactory(PgClient)
};
