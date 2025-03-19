import { Provider } from '@nestjs/common';
import { Client as PgClient } from 'pg';

import {
  BrokerModuleConfig,
  MODULE_OPTIONS_TOKEN,
} from '@src/broker/broker-module.definition';

export const createPgClientFactory =
  (Client: typeof PgClient) =>
  async (config: BrokerModuleConfig): Promise<PgClient> => {
    const client = new Client(config.postgresUri);
    await client.connect();

    return client;
  };

export const DbProvider: Provider<PgClient> = {
  provide: PgClient,
  inject: [MODULE_OPTIONS_TOKEN],
  useFactory: createPgClientFactory(PgClient),
};
