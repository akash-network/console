import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Novu } from "@novu/api";
import sanitizeHtml from "sanitize-html";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { Namespaced } from "@src/lib/types/namespaced-config.type";
import { NotificationEnvConfig } from "@src/modules/notifications/config/env.config";
import type { EmailUnsubscribe } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { type EmailAction, renderEmailLayout } from "./email-layout";

type EmailSendOptions = {
  addresses: string[];
  subject: string;
  content: string;
  userId: string;
  notificationId?: string;
  actions?: EmailAction[];
  code?: string;
  unsubscribe?: EmailUnsubscribe;
};

function oneClickUnsubscribeHeaders({ oneClickUrl }: EmailUnsubscribe) {
  return {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
  };
}

@Injectable()
export class EmailSenderService {
  constructor(
    private readonly novu: Novu,
    private readonly configService: ConfigService<Namespaced<"notifications", NotificationEnvConfig>>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(EmailSenderService.name);
  }

  async send({ addresses, userId, subject, content, notificationId, actions, code, unsubscribe }: EmailSendOptions): Promise<void> {
    await this.novu.trigger({
      workflowId: this.configService.getOrThrow("notifications.NOVU_MAILER_WORKFLOW_ID"),
      to: {
        subscriberId: userId,
        email: addresses[0]
      },
      payload: {
        subject,
        content: renderEmailLayout({
          subject,
          actions,
          code,
          unsubscribe,
          postalAddress: this.configService.get("notifications.PROMOTIONAL_EMAIL_POSTAL_ADDRESS"),
          content: sanitizeHtml(content, {
            allowedTags: ["a", "strong", "p", "br"],
            allowedAttributes: {
              a: ["href"]
            }
          })
        })
      },
      overrides: {
        email: {
          to: addresses,
          ...(unsubscribe && { headers: oneClickUnsubscribeHeaders(unsubscribe) })
        }
      }
    });

    this.loggerService.info({
      event: "EMAIL_SENT",
      notificationId,
      userId,
      subject,
      recipientCount: addresses.length
    });
  }
}
