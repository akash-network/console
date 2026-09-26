import postgres from "postgres";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { APP_CONFIG } from "@src/providers/app-config.provider";

@singleton()
export class PgClientService {
  readonly client: postgres.Sql;

  constructor(@inject(APP_CONFIG) config: EnvConfig) {
    this.client = postgres(config.POSTGRES_DB_URI, { max: 10, connection: sessionParameters(config) });
  }

  async dispose(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

/** The api role's sessions are read-only and time-bounded at the server, whatever credentials it was handed. */
function sessionParameters(config: EnvConfig): Partial<postgres.ConnectionParameters> {
  if (config.INDEXER_ROLE !== "api") {
    return {};
  }
  return { default_transaction_read_only: true, statement_timeout: config.API_STATEMENT_TIMEOUT_MS };
}
