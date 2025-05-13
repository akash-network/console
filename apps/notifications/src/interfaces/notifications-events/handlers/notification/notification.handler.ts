import { Injectable } from "@nestjs/common";

import { Handler } from "@src/infrastructure/broker";
import { NotificationCommandDto } from "@src/modules/notifications/dto/NotificationCommand.dto";
import { NotificationRouterService } from "@src/modules/notifications/services/notification-router/notification-router.service";

@Injectable()
export class NotificationHandler {
  constructor(private readonly notificationRouter: NotificationRouterService) {}

  @Handler({
    key: "notifications.v1.notification.create",
    dto: NotificationCommandDto
  })
  async send(event: NotificationCommandDto) {
    return await this.notificationRouter.send(event);
  }
}
