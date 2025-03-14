import { Injectable } from '@nestjs/common';

import { LoggerService } from '@src/common/services/logger.service';
import { NotificationCommandDto } from '@src/notifications/dto/NotificationCommand.dto';
import { NotificationRouterService } from '@src/notifications/services/notification-router/notification-router.service';

@Injectable()
export class NotificationController {
  constructor(
    private readonly notificationRouter: NotificationRouterService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(NotificationController.name);
  }

  async send(event: NotificationCommandDto) {
    await this.notificationRouter.send(event);
  }
}
