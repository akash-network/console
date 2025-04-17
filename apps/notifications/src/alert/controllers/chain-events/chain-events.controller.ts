import { MsgCloseDeployment } from '@akashnetwork/akash-api/v1beta3';
import { Injectable } from '@nestjs/common';

import { ChainBlockCreatedDto } from '@src/alert/dto/chain-block-created.dto';
import { MsgCloseDeploymentDto } from '@src/alert/dto/msg-close-deployment.dto';
import { DeploymentBalanceAlertsService } from '@src/alert/services/deployment-balance-alerts/deployment-balance-alerts.service';
import { RawAlertsService } from '@src/alert/services/raw-alerts/raw-alerts.service';
import { Handler } from '@src/broker';

@Injectable()
export class ChainEventsController {
  constructor(
    private readonly rawAlertsService: RawAlertsService,
    private readonly deploymentBalanceAlertsService: DeploymentBalanceAlertsService,
  ) {}

  @Handler({
    key: 'blockchain.v1.block.created',
    dto: ChainBlockCreatedDto,
  })
  async processBlock(block: ChainBlockCreatedDto) {
    await this.deploymentBalanceAlertsService.alertFor(block);
  }

  @Handler({
    key: MsgCloseDeployment['$type'],
    dto: MsgCloseDeploymentDto,
  })
  async processDeploymentClosed(event: MsgCloseDeploymentDto) {
    await this.rawAlertsService.alertFor(event);
  }
}
