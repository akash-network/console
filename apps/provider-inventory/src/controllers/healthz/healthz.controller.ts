import { inject, singleton } from "tsyringe";

import type { HealthzResponse } from "@src/http-schemas/healthz.schema";
import type { DbHealthcheck } from "@src/providers/postgres.provider";
import { DB_HEALTHCHECK } from "@src/providers/postgres.provider";

@singleton()
export class HealthzController {
  constructor(@inject(DB_HEALTHCHECK) private readonly dbHealthcheck: DbHealthcheck) {}

  async getStatus(): Promise<{ response: HealthzResponse; status: 200 | 503 }> {
    try {
      await this.dbHealthcheck.ping();
      return { response: { data: { status: "ok" } }, status: 200 };
    } catch {
      return { response: { data: { status: "error" } }, status: 503 };
    }
  }
}
