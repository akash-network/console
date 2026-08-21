import postgres from "postgres";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { APP_CONFIG } from "@src/providers/app-config.provider";

@singleton()
export class PgClientService {
  readonly client: postgres.Sql;

  constructor(@inject(APP_CONFIG) config: EnvConfig) {
    this.client = postgres(config.POSTGRES_DB_URI, { max: 10 });
  }

  async dispose(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
