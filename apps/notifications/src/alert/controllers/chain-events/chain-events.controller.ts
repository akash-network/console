import { Injectable } from '@nestjs/common';

import { ChainBlockCreatedDto } from '@src/alert/dto/chain-block-created.dto';
import { MsgCloseDeploymentDto } from '@src/alert/dto/msg-close-deployment.dto';
import { DeploymentBalanceAlertsService } from '@src/alert/services/deployment-balance-alerts/deployment-balance-alerts.service';
import { RawAlertsService } from '@src/alert/services/raw-alerts/raw-alerts.service';
import { LoggerService } from '@src/common/services/logger.service';

@Injectable()
export class ChainEventsController {
  constructor(
    private readonly rawAlertsService: RawAlertsService,
    private readonly deploymentBalanceAlertsService: DeploymentBalanceAlertsService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(ChainEventsController.name);
  }

  async processBlock(block: ChainBlockCreatedDto) {
    this.loggerService.log('received MsgCloseDeployment', block);
    await this.deploymentBalanceAlertsService.alertFor(block);
  }

  async processDeploymentClosed(event: MsgCloseDeploymentDto) {
    this.loggerService.log('received MsgCloseDeployment', event);
    await this.rawAlertsService.alertFor(event);
  }
}
