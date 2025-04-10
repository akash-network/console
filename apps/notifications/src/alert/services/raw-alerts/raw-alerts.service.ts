import { Injectable } from '@nestjs/common';
import template from 'lodash/template';

import {
  AlertOutput,
  RawAlertRepository,
} from '@src/alert/repositories/raw-alert/raw-alert.repository';
import { ConditionsMatcherService } from '@src/alert/services/conditions-matcher/conditions-matcher.service';
import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';

type AlertCallback = (alert: AlertOutput) => Promise<void> | void;

@Injectable()
export class RawAlertsService {
  constructor(
    private readonly alertRepository: RawAlertRepository,
    private readonly conditionsMatcher: ConditionsMatcherService,
    private readonly brokerService: BrokerService,
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

        const interpolate = template(alert.template);
        const message = interpolate(event);

        await this.brokerService.publish('notification.v1.send', {
          message,
        });
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
