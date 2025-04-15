import { Injectable } from '@nestjs/common';
import template from 'lodash/template';

import { ChainBlockCreatedDto } from '@src/alert/dto/chain-block-created.dto';
import {
  DeploymentBalanceAlertOutput,
  DeploymentBalanceAlertRepository,
} from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import { ConditionsMatcherService } from '@src/alert/services/conditions-matcher/conditions-matcher.service';
import { DeploymentService } from '@src/alert/services/deployment/deployment.service';
import { BrokerService } from '@src/broker';
import { LoggerService } from '@src/common/services/logger.service';

type AlertCallback = (
  alert: DeploymentBalanceAlertOutput,
) => Promise<void> | void;

@Injectable()
export class DeploymentBalanceAlertsService {
  constructor(
    private readonly alertRepository: DeploymentBalanceAlertRepository,
    private readonly conditionsMatcher: ConditionsMatcherService,
    private readonly brokerService: BrokerService,
    private readonly deploymentService: DeploymentService,
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
      const balance = await this.deploymentService.getDeploymentBalance(
        alert.owner,
        alert.dseq,
      );

      if (!balance) {
        // TODO: send a relevant notification. e.g. alert suspended for a "reason"
        await this.alertRepository.updateById(alert.id, { enabled: false });
        return;
      }

      const isMatching = this.conditionsMatcher.isMatching(
        alert.conditions,
        balance,
      );
      const update: Partial<DeploymentBalanceAlertOutput> = {
        minBlockHeight: block.height + this.DEPLOYMENT_BALANCE_BLOCKS_THROTTLE,
      };
      let message: string | undefined;

      if (isMatching && alert.status === 'normal') {
        const interpolate = template(alert.template);
        message = `FIRING: ${interpolate(balance)}`;
        update.status = 'firing';
      } else if (!isMatching && alert.status === 'firing') {
        const interpolate = template(alert.template);
        message = `RECOVERED: ${interpolate(balance)}`;
        update.status = 'normal';
      }

      if (message) {
        await this.brokerService.publish('notification.v1.send', {
          message,
        });
      }

      await this.alertRepository.updateById(alert.id, update);
    } catch (error) {
      this.loggerService.error({
        event: 'ALERT_FAILURE',
        alert,
        block: block.height,
        error,
      });
    }
  }
}
