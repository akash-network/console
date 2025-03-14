import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import PgBoss from 'pg-boss';

import type { BrokerModuleConfig } from '@src/broker/types/module-config.type';

export const createPgBossFactory =
  (Broker: typeof PgBoss) =>
  async (
    config: ConfigService<BrokerModuleConfig>,
    client: Client,
  ): Promise<PgBoss> => {
    // TODO: find out why custom db fails for migrations
    const migrator = new Broker(config.getOrThrow('postgresUri'));
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
  inject: [ConfigService, Client],
  useFactory: createPgBossFactory(PgBoss),
};
