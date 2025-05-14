import { Injectable } from "@nestjs/common";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { RichError } from "@src/lib/rich-error/rich-error";
import { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import { AlertRepository, DeploymentBalanceAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertMessagePayload, AlertMessageService, SendOptions } from "@src/modules/alert/services/alert-message/alert-message.service";
import { ConditionsMatcherService } from "@src/modules/alert/services/conditions-matcher/conditions-matcher.service";
import { DeploymentService } from "@src/modules/alert/services/deployment/deployment.service";
import type { MessageCallback } from "@src/modules/alert/types/message-callback.type";

type AlertCallback = (alert: DeploymentBalanceAlertOutput) => Promise<void> | void;

@Injectable()
export class DeploymentBalanceAlertsService {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly conditionsMatcher: ConditionsMatcherService,
    private readonly deploymentService: DeploymentService,
    private readonly alertMessageService: AlertMessageService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(DeploymentBalanceAlertsService.name);
  }

  private readonly DEPLOYMENT_BALANCE_BLOCKS_THROTTLE = 10;

  async alertFor(block: ChainBlockCreatedDto, onMessage: MessageCallback): Promise<void> {
    await this.forEachAlert(block.height, async alert => this.processSingleAlert(block, alert, onMessage));
  }

  private async forEachAlert(block: number, onAlert: AlertCallback) {
    try {
      await this.alertRepository.paginate({
        query: { block, type: "DEPLOYMENT_BALANCE" },
        limit: 10,
        callback: async alerts => {
          await Promise.all(alerts.map(async alert => onAlert(alert)));
        }
      });
    } catch (error) {
      this.loggerService.error({
        event: "ALERT_FAILURE",
        block,
        error
      });
      throw error;
    }
  }

  private async processSingleAlert(block: ChainBlockCreatedDto, alert: DeploymentBalanceAlertOutput, onMessage: MessageCallback) {
    try {
      const balanceResult = await this.deploymentService.getDeploymentBalance(alert.params.owner, alert.params.dseq);

      if (balanceResult.err) {
        const payload = await this.suspendErroneousAlert(balanceResult.val, alert);

        if (payload) {
          await onMessage({ payload, contactPointId: alert.contactPointId });
        }
        return;
      }
      const balanceResponse = balanceResult.val;

      const isMatching = this.conditionsMatcher.isMatching(alert.conditions, balanceResponse);
      const update: Partial<DeploymentBalanceAlertOutput> = {
        minBlockHeight: block.height + this.DEPLOYMENT_BALANCE_BLOCKS_THROTTLE
      };
      let summaryPrefix: SendOptions["summaryPrefix"];

      if (isMatching && alert.status === "NORMAL") {
        summaryPrefix = `FIRING`;
        update.status = "FIRING";
      } else if (!isMatching && alert.status === "FIRING") {
        summaryPrefix = `RECOVERED`;
        update.status = "NORMAL";
      }

      await this.alertRepository.updateById(alert.id, update);

      if (summaryPrefix) {
        const payload = this.alertMessageService.getMessage({
          summary: alert.summary,
          description: alert.description,
          vars: balanceResponse,
          summaryPrefix
        });

        if (payload) {
          await onMessage({ payload, contactPointId: alert.contactPointId });
        }
      }
    } catch (error) {
      this.loggerService.error({
        event: "ALERT_FAILURE",
        alert,
        error
      });
    }
  }

  private async suspendErroneousAlert(error: RichError, alert: DeploymentBalanceAlertOutput): Promise<AlertMessagePayload | undefined> {
    await this.alertRepository.updateById(alert.id, { enabled: false });

    if (error.code === "DEPLOYMENT_CLOSED") {
      return this.alertMessageService.getMessage({
        summary: alert.summary,
        description: `Alert is suspended as deployment is now in closed state.\n${alert.description}`,
        vars: {},
        summaryPrefix: "SUSPENDED"
      });
    } else {
      this.loggerService.error({
        event: "ALERT_FAILURE",
        alert,
        error
      });
    }
  }
}
