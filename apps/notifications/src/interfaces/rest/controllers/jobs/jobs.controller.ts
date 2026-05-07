import { BadRequestException, Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiExcludeController, ApiNoContentResponse } from "@nestjs/swagger";
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
      singletonKey: job.notificationId,
      startAfter
    };

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

/**
 * Backward-compatibility shim for the legacy /v1/jobs/notification path,
 * which apps/api still calls until it picks up the /internal/v1/* migration.
 *
 * Revert this controller (and its registration in rest.module.ts) once
 * apps/api is deployed against the new path. Hidden from swagger.json with
 * @ApiExcludeController so the public spec stays clean.
 */
@ApiExcludeController()
@Controller({ path: "v1/jobs" })
export class JobsBackwardCompatController {
  constructor(private readonly jobsController: JobsController) {}

  @Post("notification")
  @HttpCode(204)
  async createNotification(@Body() job: NotificationJobDto) {
    return this.jobsController.createNotification(job);
  }
}
