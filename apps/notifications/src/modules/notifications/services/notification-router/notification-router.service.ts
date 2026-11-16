import { Injectable } from "@nestjs/common";
import { Err, Ok, Result } from "ts-results";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { RichError } from "@src/lib/rich-error/rich-error";
import { NotificationCommandDto } from "../../dto/NotificationCommand.dto";
import { NotificationChannelRepository } from "../../repositories/notification-channel/notification-channel.repository";
import { ActivityFeedService } from "../activity-feed/activity-feed.service";
import { EmailSenderService } from "../email-sender/email-sender.service";

@Injectable()
export class NotificationRouterService {
  constructor(
    private readonly emailSenderService: EmailSenderService,
    private notificationChannelRepository: NotificationChannelRepository,
    private readonly activityFeedService: ActivityFeedService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(NotificationRouterService.name);
  }

  async send(notificationCommand: NotificationCommandDto): Promise<Result<void, RichError>> {
    const notificationChannel = await this.notificationChannelRepository.findById(notificationCommand.notificationChannelId);

    if (!notificationChannel) {
      return Err(
        new RichError("NotificationChannel not found", "NOT_FOUND", {
          notificationChannelId: notificationCommand.notificationChannelId
        })
      );
    }

    if (notificationChannel.type !== "email") {
      return Err(new RichError("NotificationChannel type not implemented", "UNSUPPORTED_NOTIFICATION_CHANNEL_TYPE", { notificationChannel }));
    }

    const addresses = notificationCommand.recipient ? [notificationCommand.recipient] : notificationChannel.config.addresses;

    if (addresses.length) {
      await this.emailSenderService.send({
        userId: notificationChannel.userId,
        addresses,
        subject: notificationCommand.payload.summary,
        content: notificationCommand.payload.description,
        actions: notificationCommand.payload.actions,
        code: notificationCommand.payload.code,
        notificationId: notificationCommand.notificationId,
        category: emailCategoryOf(notificationCommand),
        unsubscribe: notificationCommand.unsubscribe
      });
    } else {
      this.loggerService.info({ event: "EMAIL_SKIPPED", reason: "No confirmed address on the channel", notificationChannelId: notificationChannel.id });
    }

    await this.#addToFeed(notificationCommand.payload);

    return Ok(undefined);
  }

  /** Runs once the email is out, so a slow or unavailable feed never holds the email back; each entry goes to its alert's own user, whoever the channel reaches. */
  async #addToFeed({ summary, feedEntry, feedEntries = [] }: NotificationCommandDto["payload"]): Promise<void> {
    for (const entry of [feedEntry, ...feedEntries]) {
      if (!entry) continue;

      const { type, dedupeKey, alertId, dseq, userId, organizationId, projectId } = entry;
      await this.activityFeedService.addToFeed({ userId, organizationId, projectId, type, dedupeKey, meta: { alertId, summary: entry.summary ?? summary, dseq } });
    }
  }
}

/** SendGrid refuses a whole email over a non-ASCII category and keeps stats for few of them, so only a plain type name like the part of a notification id before its ids qualifies. */
const EMAIL_CATEGORY_PATTERN = /^[A-Za-z]{1,64}$/;

function emailCategoryOf({ category, notificationId }: NotificationCommandDto): string | undefined {
  const candidate = category ?? notificationId?.split(".")[0] ?? "";

  return EMAIL_CATEGORY_PATTERN.test(candidate) ? candidate : undefined;
}
