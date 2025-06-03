import { Controller, Get } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

import { HealthzHelperService } from "@src/common/services/healthz-helper/healthz-helper.service";
import { DbHealthzService } from "@src/infrastructure/db/services/db-healthz/db-healthz.service";
import { Unprotected } from "@src/interfaces/rest/interceptors/auth/auth.interceptor";

@ApiExcludeController()
@Unprotected()
@Controller("healthz")
export class HealthzController {
  constructor(
    private readonly dbHealthzService: DbHealthzService,
    private readonly healthzHelperService: HealthzHelperService
  ) {}

  @Get("readiness")
  async getReadiness() {
    return this.healthzHelperService.throwUnlessHealthy("readiness", this.dbHealthzService);
  }

  @Get("liveness")
  getLiveness() {
    return this.healthzHelperService.throwUnlessHealthy("liveness", this.dbHealthzService);
  }
}
