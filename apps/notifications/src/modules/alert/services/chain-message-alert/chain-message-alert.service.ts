import { Injectable } from "@nestjs/common";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { AlertRepository, ChainMessageAlertOutput, DeploymentBalanceAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertMessageService } from "@src/modules/alert/services/alert-message/alert-message.service";
import { ConditionsMatcherService } from "@src/modules/alert/services/conditions-matcher/conditions-matcher.service";
import type { MessageCallback } from "@src/modules/alert/types/message-callback.type";

type AlertCallback = (alert: ChainMessageAlertOutput) => Promise<void> | void;

@Injectable()
export class ChainMessageAlertService {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly conditionsMatcher: ConditionsMatcherService,
    private readonly alertMessageService: AlertMessageService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(ChainMessageAlertService.name);
  }

  async alertFor(event: object, onMessage: MessageCallback): Promise<void> {
    await this.forEachAlert(async alert => {
      try {
        const isMatching = this.conditionsMatcher.isMatching(alert.conditions, event);

        if (!isMatching) {
          return;
        }
        const payload = this.alertMessageService.getMessage({
          summary: alert.summary,
          description: alert.description,
          vars: event
        });

        const update: Partial<DeploymentBalanceAlertOutput> = { status: "TRIGGERED" };

        if ("type" in event && event.type === "akash.deployment.v1beta3.MsgCloseDeployment") {
          update.enabled = false;
        }

        await this.alertRepository.updateById(alert.id, { status: "TRIGGERED" });
        await onMessage({ payload, notificationChannelId: alert.notificationChannelId });
      } catch (error) {
        this.loggerService.error({
          event: "ALERT_FAILURE",
          alert,
          triggerEvent: event,
          error
        });
      }
    });
  }

  private async forEachAlert(onAlert: AlertCallback) {
    try {
      await this.alertRepository.paginateAll({
        // TODO: implement continuous alerts. E.g. same alert can be triggered multiple times
        query: { type: "CHAIN_MESSAGE", status: "OK" },
        limit: 10,
        callback: async alerts => {
          await Promise.all(alerts.map(async alert => onAlert(alert)));
        }
      });
    } catch (error) {
      this.loggerService.error({
        event: "ALERT_FAILURE",
        error
      });
      throw error;
    }
  }
}
