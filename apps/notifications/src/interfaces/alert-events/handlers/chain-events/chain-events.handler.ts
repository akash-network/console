import { Injectable } from "@nestjs/common";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService, Handler } from "@src/infrastructure/broker";
import { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import { EventClosedDeploymentDto } from "@src/modules/alert/dto/event-closed-deployment.dto";
import { ChainAlertService } from "@src/modules/alert/services/chain-alert/chain-alert.service";
import { DeploymentBalanceAlertsService } from "@src/modules/alert/services/deployment-balance-alerts/deployment-balance-alerts.service";

@Injectable()
export class ChainEventsHandler {
  constructor(
    private readonly chainMessageAlertService: ChainAlertService,
    private readonly deploymentBalanceAlertsService: DeploymentBalanceAlertsService,
    private readonly brokerService: BrokerService
  ) {}

  @Handler({
    key: eventKeyRegistry.blockCreated,
    dto: ChainBlockCreatedDto
  })
  async processBlock(block: ChainBlockCreatedDto) {
    await this.deploymentBalanceAlertsService.alertFor(block, message => this.brokerService.publish(eventKeyRegistry.createNotification, message));
  }

  @Handler({
    key: eventKeyRegistry.eventCloseDeployment,
    dto: EventClosedDeploymentDto
  })
  async processDeploymentClosed(payload: EventClosedDeploymentDto) {
    await this.chainMessageAlertService.alertFor({ type: "CHAIN_EVENT", payload }, message =>
      this.brokerService.publish(eventKeyRegistry.createNotification, message)
    );
  }
}
