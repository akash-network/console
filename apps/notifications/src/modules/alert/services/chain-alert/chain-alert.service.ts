import { Injectable } from "@nestjs/common";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { AlertRepository, GeneralAlertOutput, UpdateInput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertMessageService } from "@src/modules/alert/services/alert-message/alert-message.service";
import { ConditionsMatcherService } from "@src/modules/alert/services/conditions-matcher/conditions-matcher.service";
import type { MessageCallback } from "@src/modules/alert/types/message-callback.type";

type AlertCallback = (alert: GeneralAlertOutput) => Promise<void> | void;

type TriggerPayload =
  | {
      type: "CHAIN_MESSAGE";
      payload: {
        type: string;
        [key: string]: any;
      };
    }
  | {
      type: "CHAIN_EVENT";
      payload: {
        action: string;
        dseq: string;
        owner: string;
      };
    };

@Injectable()
export class ChainAlertService {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly conditionsMatcher: ConditionsMatcherService,
    private readonly alertMessageService: AlertMessageService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(ChainAlertService.name);
  }

  async alertFor(event: TriggerPayload, onMessage: MessageCallback): Promise<void> {
    await this.forEachAlert(async alert => {
      try {
        const isMatching = this.conditionsMatcher.isMatching(alert.conditions, event.payload);

        if (!isMatching) {
          return;
        }

        const update: UpdateInput = { status: "TRIGGERED" };

        if (event.type === "CHAIN_EVENT" && event.payload.action === "deployment-closed" && alert.params?.dseq) {
          update.enabled = false;
          update.params ??= {};
          update.params.suppressedBySystem = true;
        }

        const updatedAlert = await this.alertRepository.updateById(alert.id, update);

        await onMessage({
          payload: this.alertMessageService.getMessage({
            summary: alert.summary,
            description: alert.description,
            vars: {
              alert: {
                prev: alert,
                next: updatedAlert
              },
              data: event
            }
          }),
          notificationChannelId: alert.notificationChannelId
        });
      } catch (error) {
        this.loggerService.error({
          event: "ALERT_FAILURE",
          alert,
          triggerEvent: event,
          error
        });
      }
    }, event.type);
  }

  private async forEachAlert(onAlert: AlertCallback, type: "CHAIN_MESSAGE" | "CHAIN_EVENT") {
    try {
      await this.alertRepository.paginateAll({
        // TODO: implement continuous alerts. E.g. same alert can be triggered multiple times
        query: { type: type, status: "OK" },
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
