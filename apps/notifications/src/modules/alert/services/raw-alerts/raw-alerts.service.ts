import { Injectable } from '@nestjs/common';

import { LoggerService } from '@src/common/services/logger/logger.service';
import {
  AlertOutput,
  RawAlertRepository,
} from '@src/modules/alert/repositories/raw-alert/raw-alert.repository';
import { AlertMessageService } from '@src/modules/alert/services/alert-message/alert-message.service';
import { ConditionsMatcherService } from '@src/modules/alert/services/conditions-matcher/conditions-matcher.service';
import type { MessageCallback } from '@src/modules/alert/types/message-callback.type';

type AlertCallback = (alert: AlertOutput) => Promise<void> | void;

@Injectable()
export class RawAlertsService {
  constructor(
    private readonly alertRepository: RawAlertRepository,
    private readonly conditionsMatcher: ConditionsMatcherService,
    private readonly alertMessageService: AlertMessageService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(RawAlertsService.name);
  }

  async alertFor(event: object, onMessage: MessageCallback): Promise<void> {
    await this.forEachAlert(async (alert) => {
      try {
        const isMatching = this.conditionsMatcher.isMatching(
          alert.conditions,
          event,
        );

        if (!isMatching) {
          return;
        }
        const payload = this.alertMessageService.getMessage({
          summary: alert.summary,
          description: alert.description,
          vars: event,
        });
        await onMessage({ payload, contactPointId: alert.contactPointId });
      } catch (error) {
        this.loggerService.error({
          event: 'ALERT_FAILURE',
          alert,
          triggerEvent: event,
          error,
        });
      }
    });
  }

  private async forEachAlert(onAlert: AlertCallback) {
    try {
      await this.alertRepository.paginate({
        limit: 10,
        callback: async (alerts: AlertOutput[]) => {
          await Promise.all(alerts.map(async (alert) => onAlert(alert)));
        },
      });
    } catch (error) {
      this.loggerService.error({
        event: 'ALERT_FAILURE',
        error,
      });
      throw error;
    }
  }
}
