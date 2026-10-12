import { Injectable } from "@nestjs/common";
import { Err, Ok, Result } from "ts-results";

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
    private readonly activityFeedService: ActivityFeedService
  ) {}

  async send(notificationCommand: NotificationCommandDto): Promise<Result<void, RichError>> {
    const notificationChannel = await this.notificationChannelRepository.findById(notificationCommand.notificationChannelId);

    if (!notificationChannel) {
      return Err(
        new RichError("NotificationChannel not found", "NOT_FOUND", {
          notificationChannelId: notificationCommand.notificationChannelId
        })
      );
    }

    if (notificationChannel.type === "email") {
      await this.emailSenderService.send({
        userId: notificationChannel.userId,
        addresses: notificationChannel.config.addresses,
        subject: notificationCommand.payload.summary,
        content: notificationCommand.payload.description,
        actions: notificationCommand.payload.actions,
        code: notificationCommand.payload.code,
        notificationId: notificationCommand.notificationId
      });
    } else {
      return Err(new RichError("NotificationChannel type not implemented", "UNSUPPORTED_NOTIFICATION_CHANNEL_TYPE", { notificationChannel }));
    }

    await this.#addToFeed(notificationChannel.userId, notificationCommand.payload);

    return Ok(undefined);
  }

  /** Runs once the email is out, so a slow or unavailable feed never holds the email back. */
  async #addToFeed(userId: string, { summary, feedEntry }: NotificationCommandDto["payload"]): Promise<void> {
    if (!feedEntry) return;

    const { type, dedupeKey, alertId, dseq } = feedEntry;
    await this.activityFeedService.addToFeed({ userId, type, dedupeKey, meta: { alertId, summary, dseq } });
  }
}
