import { Injectable } from "@nestjs/common";
import { Err, Ok, Result } from "ts-results";

import { RichError } from "@src/lib/rich-error/rich-error";
import { NotificationCommandDto } from "../../dto/NotificationCommand.dto";
import { NotificationChannelRepository } from "../../repositories/notification-channel/notification-channel.repository";
import { EmailSenderService } from "../email-sender/email-sender.service";

@Injectable()
export class NotificationRouterService {
  constructor(
    private readonly emailSenderService: EmailSenderService,
    private notificationChannelRepository: NotificationChannelRepository
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
        content: notificationCommand.payload.description
      });
    } else {
      return Err(new RichError("NotificationChannel type not implemented", "UNSUPPORTED_NOTIFICATION_CHANNEL_TYPE", { notificationChannel }));
    }

    return Ok(undefined);
  }
}
