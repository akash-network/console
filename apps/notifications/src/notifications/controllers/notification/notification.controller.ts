import { Injectable } from '@nestjs/common';

import { Handler } from '@src/broker';
import { LoggerService } from '@src/common/services/logger/logger.service';
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

  @Handler({
    key: 'notification.v1.send',
    dto: NotificationCommandDto,
  })
  async send(event: NotificationCommandDto) {
    return await this.notificationRouter.send(event);
  }
}
