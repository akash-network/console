import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import sanitizeHtml from "sanitize-html";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { Namespaced } from "@src/lib/types/namespaced-config.type";
import { NotificationEnvConfig } from "@src/modules/notifications/config/env.config";
import type { EmailUnsubscribe } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { SendgridMailClient } from "../sendgrid-mail-client/sendgrid-mail-client.service";
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
  receivingReason?: string;
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
    private readonly sendgridMailClient: SendgridMailClient,
    private readonly configService: ConfigService<Namespaced<"notifications", NotificationEnvConfig>>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(EmailSenderService.name);
  }

  async send({ addresses, userId, subject, content, notificationId, actions, code, unsubscribe, receivingReason }: EmailSendOptions): Promise<void> {
    const { messageId } = await this.sendgridMailClient.send({
      to: addresses,
      subject,
      html: renderEmailLayout({
        subject,
        actions,
        code,
        unsubscribe,
        receivingReason,
        postalAddress: this.configService.get("notifications.PROMOTIONAL_EMAIL_POSTAL_ADDRESS"),
        content: sanitizeHtml(content, {
          allowedTags: ["a", "strong", "p", "br"],
          allowedAttributes: {
            a: ["href"]
          }
        })
      }),
      ...(unsubscribe && { headers: oneClickUnsubscribeHeaders(unsubscribe) })
    });

    this.loggerService.info({
      event: "EMAIL_SENT",
      notificationId,
      userId,
      ...(!code && { subject }),
      recipientCount: addresses.length,
      messageId
    });
  }
}
