import type { Provider } from '@nestjs/common';
import { Client } from 'pg';
import PgBoss from 'pg-boss';

import type { BrokerModuleConfig } from '@src/broker/broker-module.definition';
import { MODULE_OPTIONS_TOKEN } from '@src/broker/broker-module.definition';

export const createPgBossFactory =
  (Broker: typeof PgBoss) =>
  async (config: BrokerModuleConfig, client: Client): Promise<PgBoss> => {
    // TODO: find out why custom db fails for migrations
    const migrator = new Broker(config.postgresUri);
    await migrator.start();
    await migrator.stop();

    return new Broker({
      db: {
        executeSql(text: string, values: any[]): Promise<{ rows: any[] }> {
          return client.query(text, values);
        },
      },
    }).start();
  };

export const PgBossProvider: Provider<PgBoss> = {
  provide: PgBoss,
  inject: [MODULE_OPTIONS_TOKEN, Client],
  useFactory: createPgBossFactory(PgBoss),
};
