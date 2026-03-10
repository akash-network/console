import { Controller, Get } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

import { HealthzHelperService } from "@src/common/services/healthz-helper/healthz-helper.service";
import { BrokerHealthzService } from "@src/infrastructure/broker/services/broker-healthz/broker-healthz.service";
import { DbHealthzService } from "@src/infrastructure/db/services/db-healthz/db-healthz.service";
import { ChainEventsPollerService } from "@src/modules/chain/services/chain-events-poller/chain-events-poller.service";

@ApiExcludeController()
@Controller("healthz")
export class HealthzController {
  constructor(
    private readonly dbHealthzService: DbHealthzService,
    private readonly brokerHealthzService: BrokerHealthzService,
    private readonly healthzHelperService: HealthzHelperService,
    private readonly chainEventsPollerService: ChainEventsPollerService
  ) {}

  @Get("readiness")
  async getReadiness() {
    return await this.healthzHelperService.throwUnlessHealthy("readiness", this.dbHealthzService, this.brokerHealthzService, this.chainEventsPollerService);
  }

  @Get("liveness")
  async getLiveness() {
    return await this.healthzHelperService.throwUnlessHealthy("liveness", this.dbHealthzService, this.brokerHealthzService, this.chainEventsPollerService);
  }
}
