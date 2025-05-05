import { Injectable } from '@nestjs/common';

import { TemplateService } from '@src/alert/services/template/template.service';
import { BrokerService } from '@src/broker';

export interface SendOptions {
  alert: {
    summary: string;
    description: string;
    contactPointId: string;
  };
  vars: Record<string, any>;
  summaryPrefix?: 'FIRING' | 'RECOVERED' | 'SUSPENDED' | string;
}

@Injectable()
export class AlertSenderService {
  constructor(
    private readonly brokerService: BrokerService,
    private readonly templateService: TemplateService,
  ) {}

  async send({ alert, vars, summaryPrefix }: SendOptions) {
    let summary = this.templateService.interpolate(alert.summary, vars);

    if (summaryPrefix) {
      summary = `[${summaryPrefix}] ${summary}`;
    }

    const description = this.templateService.interpolate(
      alert.description,
      vars,
    );

    await this.brokerService.publish('notification.v1.send', {
      payload: {
        summary,
        description,
      },
      contactPointId: alert.contactPointId,
    });
  }
}
