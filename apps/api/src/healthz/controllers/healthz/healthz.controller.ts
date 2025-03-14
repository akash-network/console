import { injectable } from "tsyringe";

import type { HealthzResponse } from "@src/healthz/routes/healthz.router";
import { HealthzService } from "@src/healthz/services/healthz/healthz.service";

@injectable()
export class HealthzController {
  constructor(private readonly healthzService: HealthzService) {}

  async getReadinessStatus(): Promise<HealthzResponse & { status: "ok" | "error" }> {
    return this.healthzService.getReadinessStatus();
  }

  async getLivenessStatus(): Promise<HealthzResponse & { status: "ok" | "error" }> {
    return this.healthzService.getLivenessStatus();
  }
}
