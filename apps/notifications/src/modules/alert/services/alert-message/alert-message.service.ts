import { Injectable } from '@nestjs/common';

import { TemplateService } from '@src/modules/alert/services/template/template.service';

export interface SendOptions {
  summary: string;
  description: string;
  vars: Record<string, any>;
  summaryPrefix?: 'FIRING' | 'RECOVERED' | 'SUSPENDED' | string;
}

export interface AlertMessagePayload {
  summary: string;
  description: string;
}

@Injectable()
export class AlertMessageService {
  constructor(private readonly templateService: TemplateService) {}

  getMessage({
    vars,
    summaryPrefix,
    ...templates
  }: SendOptions): AlertMessagePayload {
    let summary = this.templateService.interpolate(templates.summary, vars);

    if (summaryPrefix) {
      summary = `[${summaryPrefix}] ${summary}`;
    }

    const description = this.templateService.interpolate(
      templates.description,
      vars,
    );

    return {
      summary,
      description,
    };
  }
}
