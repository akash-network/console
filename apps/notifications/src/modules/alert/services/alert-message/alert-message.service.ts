import { Injectable } from "@nestjs/common";

import { TemplateService } from "@src/modules/alert/services/template/template.service";

export interface SendOptions {
  summary: string;
  description: string;
  vars: Record<string, any>;
}

export interface AlertMessagePayload {
  summary: string;
  description: string;
}

@Injectable()
export class AlertMessageService {
  constructor(private readonly templateService: TemplateService) {}

  getMessage({ vars, ...templates }: SendOptions): AlertMessagePayload {
    return {
      summary: this.templateService.interpolate(templates.summary, vars),
      description: this.templateService.interpolate(templates.description, vars)
    };
  }
}
