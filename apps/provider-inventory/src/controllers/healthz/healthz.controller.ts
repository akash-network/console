import { LoggerService } from "@akashnetwork/logging";
import { inject, singleton } from "tsyringe";

import type { HealthzResponse } from "@src/http-schemas/healthz.schema";
import { LOGGER_FACTORY, type LoggerFactory } from "@src/providers";
import type { DbHealthcheck } from "@src/providers/postgres.provider";
import { DB_HEALTHCHECK } from "@src/providers/postgres.provider";

@singleton()
export class HealthzController {
  readonly #dbHealthcheck: DbHealthcheck;
  readonly #logger: LoggerService;

  constructor(@inject(DB_HEALTHCHECK) dbHealthcheck: DbHealthcheck, @inject(LOGGER_FACTORY) createLogger: LoggerFactory) {
    this.#dbHealthcheck = dbHealthcheck;
    this.#logger = createLogger({ context: "healthz" });
  }

  async getReadinessStatus(): Promise<{ response: HealthzResponse; status: 200 | 503 }> {
    return this.#getStatus();
  }

  async getLivenessStatus(): Promise<{ response: HealthzResponse; status: 200 | 503 }> {
    return this.#getStatus();
  }

  async #getStatus(): Promise<{ response: HealthzResponse; status: 200 | 503 }> {
    try {
      await this.#dbHealthcheck.ping();
      return { response: { data: { status: "ok" } }, status: 200 };
    } catch (error) {
      this.#logger.error({ event: "HEALTH_ERROR", error });
      return { response: { data: { status: "error" } }, status: 503 };
    }
  }
}
