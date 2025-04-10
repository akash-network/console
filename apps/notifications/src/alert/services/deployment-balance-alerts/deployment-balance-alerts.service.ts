import { Injectable } from '@nestjs/common';
import axios from "axios";
import template from 'lodash/template';

import { ChainBlockCreatedDto } from '@src/alert/dto/chain-block-created.dto';
import {
  DeploymentBalanceAlertOutput,
  DeploymentBalanceAlertRepository,
} from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';
import { ConditionsMatcherService } from '@src/alert/services/conditions-matcher/conditions-matcher.service';
import { BrokerService } from '@src/broker/services/broker/broker.service';
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
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(DeploymentBalanceAlertsService.name);
  }

  async alertFor(block: ChainBlockCreatedDto): Promise<void> {
    await this.forEachAlert(block.height, async (alert) => {
      console.log('DEBUG alert', alert)
      try {
        const balance = await this.getDeploymentBalance(
          alert.owner,
          alert.dseq,
        );

        if (!balance) {
          // TODO: decide what to do here, prob the alert should be disabled
          return
        }
        
        const isMatching =
          !!balance &&
          this.conditionsMatcher.isMatching(alert.conditions, balance);
        
        console.log('DEBUG isMatching', isMatching)
        const update: Partial<DeploymentBalanceAlertOutput> = {
          minBlockHeight: block.height + 10
        }
        let message: string | undefined;

        if (isMatching && alert.status === 'normal') {
          const interpolate = template(alert.template);
          message = `FIRING: ${interpolate(balance)}`;
          update.status = 'firing'
        } else if (!isMatching && alert.status === 'firing') {
          const interpolate = template(alert.template);
          message = `RECOVERED: ${interpolate(balance)}`;
          update.status = 'normal'
        }

        if (message) {
          await this.brokerService.publish('notification.v1.send', {
            message
          });
        }

        await this.alertRepository.updateById(alert.id, update);
      } catch (error) {
        this.loggerService.error({
          event: 'ALERT_FAILURE',
          alert,
          triggerEvent: block,
          error,
        });
      }
    }).catch(error => {
      this.loggerService.error({
        event: 'ALERT_FAILURE',
        triggerEvent: block,
        error,
      });

      return Promise.reject(error)
    });
  }

  private async getDeploymentBalance(
    owner: string,
    dseq: string,
  ): Promise<{ balance: number } | null> {
    const { data: result } = await axios.get<any>(
      'https://consoleapi.akashnet.net/akash/deployment/v1beta3/deployments/info',
      {
        params: {
          'id.owner': owner,
          'id.dseq': dseq,
        },
      },
    );

    if (!('deployment' in result)) {
      this.loggerService.error({
        event: 'BALANCE_FETCH_ERROR',
        owner,
        dseq,
        error: result,
      });

      return null;
    }

    const balance = result.escrow_account.balance;
    const funds = result.escrow_account.funds;

    const balanceAmount =
      balance.denom === 'uakt'
        ? parseInt(balance.amount)
        : parseInt(balance.amount) * 1_000_000;
    const fundsAmount =
      funds.denom === 'uakt'
        ? parseInt(funds.amount)
        : parseInt(funds.amount) * 1_000_000;

    return { balance: balanceAmount + fundsAmount };
  }

  private async forEachAlert(block: number, callback: AlertCallback) {
    await this.alertRepository.paginate({
      query: { block },
      limit: 10,
      callback: async (alerts: DeploymentBalanceAlertOutput[]) => {
        await Promise.all(alerts.map(async (alert) => callback(alert)));
      },
    });
  }
}
