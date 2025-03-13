import { Injectable, OnModuleInit } from '@nestjs/common';
import { validate } from 'nestjs-zod';

import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';
import { NotificationController } from '@src/notifications/controllers/notification/notification.controller';
import { NotificationCommandDto } from '@src/notifications/dto/NotificationCommand.dto';

@Injectable()
export class NotificationCommandHandler implements OnModuleInit {
  constructor(
    private readonly broker: BrokerService,
    private readonly notificationController: NotificationController,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(NotificationCommandHandler.name);
  }

  async onModuleInit() {
    await this.broker.subscribe<NotificationCommandDto>(
      'notification.v1.send',
      { prefetchCount: 10 },
      async (events) => {
        events.map(async (event) => {
          const msg = validate(event.data, NotificationCommandDto);
          await this.notificationController.send(msg);
        });
      },
    );
  }
}
