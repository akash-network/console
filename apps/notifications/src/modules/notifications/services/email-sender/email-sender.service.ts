import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Novu } from "@novu/api";
import sanitizeHtml from "sanitize-html";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { Namespaced } from "@src/lib/types/namespaced-config.type";
import { NotificationEnvConfig } from "@src/modules/notifications/config/env.config";

type EmailSendOptions = {
  addresses: string[];
  subject: string;
  content: string;
  userId: string;
};

@Injectable()
export class EmailSenderService {
  constructor(
    private readonly novu: Novu,
    private readonly configService: ConfigService<Namespaced<"notifications", NotificationEnvConfig>>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(EmailSenderService.name);
  }

  async send({ addresses, userId, subject, content }: EmailSendOptions): Promise<void> {
    await this.novu.trigger({
      workflowId: this.configService.getOrThrow("notifications.NOVU_MAILER_WORKFLOW_ID"),
      to: {
        subscriberId: userId,
        email: addresses[0]
      },
      payload: {
        subject,
        content: sanitizeHtml(content, {
          allowedTags: ["a", "strong"],
          allowedAttributes: {
            a: ["href"]
          }
        })
      },
      overrides: {
        email: {
          to: addresses
        }
      }
    });
  }
}
