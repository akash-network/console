import { DrizzlePGModule } from "@knaadh/nestjs-drizzle-pg";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { Logger } from "@src/common/providers/logger.provider";
import { DRIZZLE_PROVIDER_TOKEN } from "./config/db.config";
import type { DbConfig } from "./config";
import config from "./config";

const logger = new Logger({ context: "DRIZZLE" });

export const register = <TSchema extends Record<string, unknown> = Record<string, never>>(schema: TSchema) => [
  ConfigModule.forFeature(config),
  DrizzlePGModule.registerAsync({
    tag: DRIZZLE_PROVIDER_TOKEN,
    inject: [ConfigService],
    useFactory(configService: ConfigService<DbConfig>) {
      return {
        pg: {
          connection: "pool",
          config: {
            connectionString: configService.getOrThrow("db.NOTIFICATIONS_POSTGRES_URL")
          }
        },
        config: {
          schema,
          logger: {
            logQuery(query, params) {
              logger.debug({ query, params });
            }
          }
        }
      };
    }
  })
];
