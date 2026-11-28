import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { type Disposable, inject, singleton } from "tsyringe";

import * as schema from "@src/model-schemas";
import { AppConfigService } from "@src/services/app-config/app-config.service";

const CONNECT_TIMEOUT_SECONDS = 5;
const IDLE_TIMEOUT_SECONDS = 60;
const CLOSE_TIMEOUT_SECONDS = 5;
/** Kept short because a request waits on these statements before anything is signed. */
const STATEMENT_TIMEOUT_MS = 3_000;

export type FundingControlsOrm = PostgresJsDatabase<typeof schema>;

/** The signer's own database, which the API has no credentials for, so nothing the API does can lift a freeze. */
@singleton()
export class FundingControlsDatabase implements Disposable {
  readonly #client: postgres.Sql | undefined;
  readonly #orm: FundingControlsOrm | undefined;

  constructor(@inject(AppConfigService) config: AppConfigService) {
    const url = config.get("FUNDING_CONTROLS_POSTGRES_URL");

    this.#client = url
      ? postgres(url, {
          max: config.get("FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS"),
          connect_timeout: CONNECT_TIMEOUT_SECONDS,
          idle_timeout: IDLE_TIMEOUT_SECONDS,
          connection: { statement_timeout: STATEMENT_TIMEOUT_MS }
        })
      : undefined;
    this.#orm = this.#client && drizzle(this.#client, { schema });
  }

  get isConfigured(): boolean {
    return this.#orm !== undefined;
  }

  get orm(): FundingControlsOrm {
    if (!this.#orm) throw new Error("FUNDING_CONTROLS_POSTGRES_URL is not set, so this signer has no funding controls to read");

    return this.#orm;
  }

  async dispose(): Promise<void> {
    await this.#client?.end({ timeout: CLOSE_TIMEOUT_SECONDS });
  }
}
