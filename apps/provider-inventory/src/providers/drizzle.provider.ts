import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { PG_CLIENT } from "@src/providers/postgres.provider";
import * as modelsSchema from "../model-schemas";

export const DRIZZLE_DB: InjectionToken<PostgresJsDatabase> = Symbol("DRIZZLE_DB");

container.register(DRIZZLE_DB, {
  useFactory: instancePerContainerCachingFactory(c =>
    drizzle(c.resolve(PG_CLIENT), {
      schema: modelsSchema
    })
  )
});
