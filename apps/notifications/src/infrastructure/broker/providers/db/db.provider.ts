import type { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { BrokerConfig } from "@src/infrastructure/broker/config";

export const createPgPoolFactory =
  (PgPool: typeof Pool) =>
  async (config: ConfigService<BrokerConfig>): Promise<Pool> => {
    const logger = new LoggerService({ context: "BrokerDb" });
    const pool = new PgPool({
      connectionString: config.getOrThrow("broker.EVENT_BROKER_POSTGRES_URI")
    });

    pool.on("error", error => {
      logger.error({ event: "BROKER_DB_CONNECTION_ERROR", error });
    });

    return pool;
  };

export const DbProvider: Provider<Pool> = {
  provide: Pool,
  inject: [ConfigService],
  useFactory: createPgPoolFactory(Pool)
};
