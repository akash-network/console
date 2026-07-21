import { Controller, Get } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

import { HealthzHelperService } from "@src/common/services/healthz-helper/healthz-helper.service";
import type { SummarizedProbeResult } from "@src/common/types/healthz.type";
import { BrokerHealthzService } from "@src/infrastructure/broker/services/broker-healthz/broker-healthz.service";
import { DbHealthzService } from "@src/infrastructure/db/services/db-healthz/db-healthz.service";

@ApiExcludeController()
@Controller("healthz")
export class WorkerHealthzController {
  constructor(
    private readonly dbHealthzService: DbHealthzService,
    private readonly brokerHealthzService: BrokerHealthzService,
    private readonly healthzHelperService: HealthzHelperService
  ) {}

  @Get("readiness")
  async getReadiness(): Promise<SummarizedProbeResult> {
    return await this.healthzHelperService.throwUnlessHealthy("readiness", this.dbHealthzService, this.brokerHealthzService);
  }

  @Get("liveness")
  async getLiveness(): Promise<SummarizedProbeResult> {
    return await this.healthzHelperService.throwUnlessHealthy("liveness", this.dbHealthzService, this.brokerHealthzService);
  }
}
