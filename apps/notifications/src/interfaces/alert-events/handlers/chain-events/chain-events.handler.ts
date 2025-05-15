import { MsgCloseDeployment } from "@akashnetwork/akash-api/v1beta3";
import { Injectable } from "@nestjs/common";

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
    key: "blockchain.v1.block.created",
    dto: ChainBlockCreatedDto
  })
  async processBlock(block: ChainBlockCreatedDto) {
    await this.deploymentBalanceAlertsService.alertFor(block, message => this.brokerService.publish("notifications.v1.notification.send", message));
  }

  @Handler({
    key: MsgCloseDeployment["$type"],
    dto: MsgCloseDeploymentDto
  })
  async processDeploymentClosed(event: MsgCloseDeploymentDto) {
    await this.chainMessageAlertService.alertFor(event, message => this.brokerService.publish("notifications.v1.notification.send", message));
  }
}
