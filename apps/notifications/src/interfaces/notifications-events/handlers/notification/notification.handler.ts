import { Injectable } from "@nestjs/common";
import type { Result } from "ts-results";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { Handler } from "@src/infrastructure/broker";
import type { RichError } from "@src/lib/rich-error/rich-error";
import { NotificationCommandDto } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { NotificationRouterService } from "@src/modules/notifications/services/notification-router/notification-router.service";

@Injectable()
export class NotificationHandler {
  constructor(private readonly notificationRouter: NotificationRouterService) {}

  @Handler({
    key: eventKeyRegistry.createNotification,
    dto: NotificationCommandDto
  })
  async send(event: NotificationCommandDto): Promise<Result<void, RichError>> {
    return await this.notificationRouter.send(event);
  }
}
