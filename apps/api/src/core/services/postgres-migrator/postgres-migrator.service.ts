import { migrate } from "drizzle-orm/node-postgres/migrator";
import { inject, singleton } from "tsyringe";

import { ApiPgDatabase, CORE_CONFIG, CoreConfig, InjectPg } from "@src/core/providers";

@singleton()
export class PostgresMigratorService {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @inject(CORE_CONFIG) private readonly config: CoreConfig
  ) {}

  async migrate() {
    // TODO: remove condition once billing is in prod
    if (this.config.POSTGRES_DB_URI) {
      return migrate(this.pg, { migrationsFolder: "./drizzle" });
    }
  }
}
