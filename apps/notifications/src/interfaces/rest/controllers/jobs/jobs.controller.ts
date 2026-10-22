import { BadRequestException, Body, Controller, HttpCode, Post, UsePipes } from "@nestjs/common";
import { ApiNoContentResponse } from "@nestjs/swagger";
import { createZodDto, ZodValidationPipe } from "nestjs-zod";
import { Err, Ok, Result } from "ts-results";
import { z } from "zod";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService, PublishOptions } from "@src/infrastructure/broker/services/broker/broker.service";
import { EmailRecipientSchema, EmailUnsubscribeSchema } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { NotificationChannelRepository } from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { AuthService } from "../../services/auth/auth.service";

class NotificationJobDto extends createZodDto(
  z.object({
    notificationId: z.string(),
    notificationChannelId: z.string().optional(),
    startAfter: z.string().datetime().optional(),
    payload: z.object({
      summary: z.string(),
      description: z.string(),
      code: z.string().optional(),
      actions: z
        .array(
          z.object({
            label: z.string(),
            url: z.string().url()
          })
        )
        .optional()
    }),
    unsubscribe: EmailUnsubscribeSchema.optional(),
    recipient: EmailRecipientSchema.optional()
  })
) {}

@Controller({
  path: "internal/v1/jobs"
})
export class JobsController {
  constructor(
    private readonly brokerService: BrokerService,
    private readonly authService: AuthService,
    private readonly notificationChannelRepository: NotificationChannelRepository
  ) {}

  @Post("notification")
  @HttpCode(204)
  @UsePipes(ZodValidationPipe)
  @ApiNoContentResponse({ description: "Creates a notification job" })
  async createNotification(@Body() job: NotificationJobDto): Promise<Result<void, BadRequestException>> {
    const notificationChannelRepository = this.notificationChannelRepository.accessibleBy(this.authService.ability, "read");
    const notificationChannel = job.notificationChannelId
      ? await notificationChannelRepository.findById(job.notificationChannelId)
      : await notificationChannelRepository.findDefault(this.authService.defaultChannelOwner);

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
      singletonKey: job.notificationId,
      startAfter
    };

    await this.brokerService.publish(
      eventKeyRegistry.createNotification,
      {
        payload: job.payload,
        notificationChannelId: notificationChannel.id,
        notificationId: job.notificationId,
        unsubscribe: job.unsubscribe,
        recipient: job.recipient
      },
      publishOptions
    );
    return Ok(undefined);
  }
}
