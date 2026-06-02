import { PostgresLoggerService } from "@akashnetwork/logging/sql";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { parseJsonb, serializeJsonb } from "@src/lib/jsonb-bigint/jsonb-bigint";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { LOGGER_FACTORY } from "@src/providers/logger-factory.provider";
import { JSON_OIDS, PG_CLIENT } from "@src/providers/postgres.provider";
import * as modelsSchema from "../model-schemas";

export const DRIZZLE_DB: InjectionToken<PostgresJsDatabase> = Symbol("DRIZZLE_DB");

container.register(DRIZZLE_DB, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(APP_CONFIG);
    const client = c.resolve(PG_CLIENT);
    const db = drizzle(client, {
      logger: new PostgresLoggerService(c.resolve(LOGGER_FACTORY), { useFormat: config.SQL_LOG_FORMAT === "pretty" }),
      schema: modelsSchema
    });

    // drizzle 0.45's construct() clobbers the shared client's json/jsonb serializers with a passthrough.
    // Re-assert ours so bigint-preserving (de)serialization stays a postgres.js client concern for BOTH
    // the ORM (jsonbBigint passes through to here) and raw `sql` queries (e.g. bid-screening's sql.json).
    // NOTE: this means jsonb columns must use the jsonbBigint customType (passthrough), never drizzle's
    // native jsonb(), which would double-encode by stringifying in toDriver before this serializer runs.
    for (const oid of JSON_OIDS) {
      client.options.serializers[oid] = serializeJsonb;
      client.options.parsers[oid] = parseJsonb;
    }

    return db;
  })
});
