import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as PgClient } from 'pg';

import { BrokerModuleConfig } from '@src/broker/types/module-config.type';

export const createPgClientFactory =
  (Client: typeof PgClient) =>
  async (config: ConfigService<BrokerModuleConfig>): Promise<PgClient> => {
    const client = new Client(config.getOrThrow('postgresUri'));
    await client.connect();

    return client;
  };

export const DbProvider: Provider<PgClient> = {
  provide: PgClient,
  inject: [ConfigService],
  useFactory: createPgClientFactory(PgClient),
};
