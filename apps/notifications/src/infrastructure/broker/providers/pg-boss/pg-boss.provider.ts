import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { type ConstructorOptions, PgBoss } from "pg-boss";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { BrokerConfig } from "@src/infrastructure/broker/config";

const FEATURES_KEPT_OFF = { reindex: false, openTelemetry: { enabled: false } } satisfies ConstructorOptions;

export const createPgBossFactory =
  (Broker: typeof PgBoss) =>
  async (config: ConfigService<BrokerConfig>, pool: Pool): Promise<PgBoss> => {
    // TODO: find out why custom db fails for migrations
    const migrator = new Broker({ connectionString: config.getOrThrow("broker.EVENT_BROKER_POSTGRES_URI"), ...FEATURES_KEPT_OFF });
    await migrator.start();
    await migrator.stop();

    const broker = new Broker({
      ...FEATURES_KEPT_OFF,
      db: {
        executeSql(text: string, values: any[]): Promise<{ rows: any[] }> {
          return pool.query(text, values);
        }
      }
    });

    const logger = new LoggerService({ context: "PgBoss" });
    broker.on("error", error => {
      logger.error({ event: "WORKER_UNHANDLED_ERROR", error });
    });

    return broker.start();
  };

export const PgBossProvider: Provider<PgBoss> = {
  provide: PgBoss,
  inject: [ConfigService, Pool],
  useFactory: createPgBossFactory(PgBoss)
};
