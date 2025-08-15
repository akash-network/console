import { BadRequestException, Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiNoContentResponse } from "@nestjs/swagger";
import { hoursToSeconds } from "date-fns";
import { createZodDto } from "nestjs-zod";
import { Err, Ok, Result } from "ts-results";
import { z } from "zod";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService, PublishOptions } from "@src/infrastructure/broker/services/broker/broker.service";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { AuthService } from "../../services/auth/auth.service";

class NotificationJobDto extends createZodDto(
  z.object({
    notificationId: z.string(),
    notificationChannelId: z.string().optional(),
    startAfter: z.string().datetime().optional(),
    payload: z.object({
      summary: z.string(),
      description: z.string()
    })
  })
) {}

export const DEFAULT_NOTIFICATION_EXPIRATION_IN_SECONDS = hoursToSeconds(24);

@Controller({
  version: "1",
  path: "jobs"
})
export class JobsController {
  constructor(
    private readonly brokerService: BrokerService,
    private readonly authService: AuthService,
    private readonly notificationChannelRepository: NotificationChannelRepository
  ) {}

  @Post("notification")
  @HttpCode(204)
  @ApiNoContentResponse({ description: "Creates a notification job" })
  async createNotification(@Body() job: NotificationJobDto): Promise<Result<void, BadRequestException>> {
    const notificationChannelRepository = this.notificationChannelRepository.accessibleBy(this.authService.ability, "read");
    const notificationChannel = job.notificationChannelId
      ? await notificationChannelRepository.findById(job.notificationChannelId)
      : await notificationChannelRepository.findDefaultByUserId(this.authService.userId);

    if (!notificationChannel) {
      return Err(
        new BadRequestException({
          message: "Notification channel not found",
          code: "NOTIFICATION_CHANNEL_NOT_FOUND"
        })
      );
    }

    const startAfter = job.startAfter ? new Date(job.startAfter) : undefined;
    const publishOptions: PublishOptions = {
      id: job.notificationId,
      startAfter,
      expireInSeconds: DEFAULT_NOTIFICATION_EXPIRATION_IN_SECONDS
    };

    if (startAfter) {
      publishOptions.expireInSeconds = Math.ceil((startAfter.getTime() - Date.now()) / 1000) + DEFAULT_NOTIFICATION_EXPIRATION_IN_SECONDS;
    }

    await this.brokerService.publish(
      eventKeyRegistry.createNotification,
      {
        payload: job.payload,
        notificationChannelId: notificationChannel.id
      },
      publishOptions
    );
    return Ok(undefined);
  }
}
