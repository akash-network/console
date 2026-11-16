import { Injectable } from "@nestjs/common";
import type { Result } from "ts-results";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { Handler } from "@src/infrastructure/broker";
import type { QueueRetryOptions } from "@src/infrastructure/broker/services/broker/broker.service";
import type { RichError } from "@src/lib/rich-error/rich-error";
import { NotificationCommandDto } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { NotificationRouterService } from "@src/modules/notifications/services/notification-router/notification-router.service";

/** Retries for about an hour and a half, doubling from 30 s, so a SendGrid outage delays an email instead of dropping it. */
const NOTIFICATION_RETRY: QueueRetryOptions = {
  retryLimit: 8,
  retryDelay: 30,
  retryBackoff: true,
  retryDelayMax: 1800
};

@Injectable()
export class NotificationHandler {
  constructor(private readonly notificationRouter: NotificationRouterService) {}

  @Handler({
    key: eventKeyRegistry.createNotification,
    dto: NotificationCommandDto,
    retry: NOTIFICATION_RETRY
  })
  async send(event: NotificationCommandDto): Promise<Result<void, RichError>> {
    return await this.notificationRouter.send(event);
  }
}
