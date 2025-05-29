import { Injectable } from "@nestjs/common";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService, Handler } from "@src/infrastructure/broker";
import { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import { MsgCloseDeploymentDto } from "@src/modules/alert/dto/msg-close-deployment.dto";
import { ChainMessageAlertService } from "@src/modules/alert/services/chain-message-alert/chain-message-alert.service";
import { DeploymentBalanceAlertsService } from "@src/modules/alert/services/deployment-balance-alerts/deployment-balance-alerts.service";

@Injectable()
export class ChainEventsHandler {
  constructor(
    private readonly chainMessageAlertService: ChainMessageAlertService,
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
    key: eventKeyRegistry.msgCloseDeployment,
    dto: MsgCloseDeploymentDto
  })
  async processDeploymentClosed(event: MsgCloseDeploymentDto) {
    await this.chainMessageAlertService.alertFor(event, message => this.brokerService.publish(eventKeyRegistry.createNotification, message));
  }
}
