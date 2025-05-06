import { Injectable } from '@nestjs/common';

import {
  AlertOutput,
  RawAlertRepository,
} from '@src/alert/repositories/raw-alert/raw-alert.repository';
import { AlertSenderService } from '@src/alert/services/alert-sender/alert-sender.service';
import { ConditionsMatcherService } from '@src/alert/services/conditions-matcher/conditions-matcher.service';
import { LoggerService } from '@src/common/services/logger/logger.service';

type AlertCallback = (alert: AlertOutput) => Promise<void> | void;

@Injectable()
export class RawAlertsService {
  constructor(
    private readonly alertRepository: RawAlertRepository,
    private readonly conditionsMatcher: ConditionsMatcherService,
    private readonly alertSenderService: AlertSenderService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(RawAlertsService.name);
  }

  async alertFor(event: object): Promise<void> {
    await this.forEachAlert(async (alert) => {
      try {
        const isMatching = this.conditionsMatcher.isMatching(
          alert.eventConditions,
          event,
        );

        if (!isMatching) {
          return;
        }
        await this.alertSenderService.send({ alert, vars: event });
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

  private async forEachAlert(callback: AlertCallback) {
    try {
      await this.alertRepository.paginate({
        limit: 10,
        callback: async (alerts: AlertOutput[]) => {
          await Promise.all(alerts.map(async (alert) => callback(alert)));
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
