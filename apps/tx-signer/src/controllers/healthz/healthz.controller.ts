import { singleton } from "tsyringe";

import type { HealthzResponse } from "@src/http-schemas/healthz.schema";

@singleton()
export class HealthzController {
  async getStatus(): Promise<HealthzResponse> {
    return {
      data: {
        status: "ok"
      }
    };
  }
}
