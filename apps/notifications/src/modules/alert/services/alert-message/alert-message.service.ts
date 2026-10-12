import { Injectable } from "@nestjs/common";

import { TemplateService } from "@src/modules/alert/services/template/template.service";
import type { AlertFeedEntry } from "@src/modules/notifications/dto/NotificationCommand.dto";

export interface SendOptions {
  summary: string;
  description: string;
  vars?: Record<string, any>;
}

export interface AlertMessagePayload {
  summary: string;
  description: string;
  /** Set by the alerts that also show in the user's activity feed, which get an entry once their email is sent. */
  feedEntry?: AlertFeedEntry;
}

@Injectable()
export class AlertMessageService {
  constructor(private readonly templateService: TemplateService) {}

  getMessage({ vars = {}, ...templates }: SendOptions): AlertMessagePayload {
    return {
      summary: this.templateService.interpolate(templates.summary, vars),
      description: this.templateService.interpolate(templates.description, vars)
    };
  }
}
