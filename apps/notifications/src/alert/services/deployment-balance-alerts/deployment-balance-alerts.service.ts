import { Injectable } from '@nestjs/common';

import { ChainBlockCreatedDto } from '@src/alert/dto/chain-block-created.dto';
import {
  DeploymentBalanceAlertOutput,
  DeploymentBalanceAlertRepository,
} from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import {
  AlertSenderService,
  SendOptions,
} from '@src/alert/services/alert-sender/alert-sender.service';
import { ConditionsMatcherService } from '@src/alert/services/conditions-matcher/conditions-matcher.service';
import { DeploymentService } from '@src/alert/services/deployment/deployment.service';
import { LoggerService } from '@src/common/services/logger/logger.service';
import { RichError } from '@src/lib/rich-error/rich-error';

type AlertCallback = (
  alert: DeploymentBalanceAlertOutput,
) => Promise<void> | void;

@Injectable()
export class DeploymentBalanceAlertsService {
  constructor(
    private readonly alertRepository: DeploymentBalanceAlertRepository,
    private readonly conditionsMatcher: ConditionsMatcherService,
    private readonly deploymentService: DeploymentService,
    private readonly alertSenderService: AlertSenderService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(DeploymentBalanceAlertsService.name);
  }

  private readonly DEPLOYMENT_BALANCE_BLOCKS_THROTTLE = 10;

  async alertFor(block: ChainBlockCreatedDto): Promise<void> {
    await this.forEachAlert(block.height, async (alert) =>
      this.processSingleAlert(block, alert),
    );
  }

  private async forEachAlert(block: number, callback: AlertCallback) {
    try {
      await this.alertRepository.paginate({
        query: { block },
        limit: 10,
        callback: async (alerts: DeploymentBalanceAlertOutput[]) => {
          await Promise.all(alerts.map(async (alert) => callback(alert)));
        },
      });
    } catch (error) {
      this.loggerService.error({
        event: 'ALERT_FAILURE',
        block,
        error,
      });
      throw error;
    }
  }

  private async processSingleAlert(
    block: ChainBlockCreatedDto,
    alert: DeploymentBalanceAlertOutput,
  ) {
    try {
      const balanceResult = await this.deploymentService.getDeploymentBalance(
        alert.owner,
        alert.dseq,
      );

      if (balanceResult.err) {
        await this.suspendErroneousAlert(balanceResult.val, alert);
        return;
      }
      const balanceResponse = balanceResult.val;

      const isMatching = this.conditionsMatcher.isMatching(
        alert.conditions,
        balanceResponse,
      );
      const update: Partial<DeploymentBalanceAlertOutput> = {
        minBlockHeight: block.height + this.DEPLOYMENT_BALANCE_BLOCKS_THROTTLE,
      };
      let summaryPrefix: SendOptions['summaryPrefix'];

      if (isMatching && alert.status === 'normal') {
        summaryPrefix = `FIRING`;
        update.status = 'firing';
      } else if (!isMatching && alert.status === 'firing') {
        summaryPrefix = `RECOVERED`;
        update.status = 'normal';
      }

      await this.alertRepository.updateById(alert.id, update);

      if (summaryPrefix) {
        await this.alertSenderService.send({
          alert,
          vars: balanceResponse,
          summaryPrefix,
        });
      }
    } catch (error) {
      this.loggerService.error({
        event: 'ALERT_FAILURE',
        alert,
        error,
      });
    }
  }

  private async suspendErroneousAlert(
    error: RichError,
    alert: DeploymentBalanceAlertOutput,
  ): Promise<void> {
    await this.alertRepository.updateById(alert.id, { enabled: false });

    if (error.code === 'DEPLOYMENT_CLOSED') {
      await this.alertSenderService.send({
        alert: {
          ...alert,
          description: `Alert is suspended as deployment is now in closed state.\n${alert.description}`,
        },
        vars: {},
        summaryPrefix: 'SUSPENDED',
      });
    } else {
      this.loggerService.error({
        event: 'ALERT_FAILURE',
        alert,
        error,
      });
    }
  }
}
