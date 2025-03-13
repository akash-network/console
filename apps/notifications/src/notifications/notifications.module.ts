import { Module } from '@nestjs/common';

import { BrokerModule } from '@src/broker/broker.module';
import { CommonModule } from '@src/common/common.module';
import {
  configService,
  ConfigServiceProvider,
} from '@src/notifications/config/env.config';
import { NotificationController } from './controllers/notification/notification.controller';
import { NotificationCommandHandler } from './handlers/notification-command/notification-command.handler';
import { NovuProvider } from './providers/novu.provider';
import { EmailSenderService } from './services/email-sender/email-sender.service';
import { NotificationRouterService } from './services/notification-router/notification-router.service';

@Module({
  imports: [
    CommonModule,
    BrokerModule.forRoot({
      appName: 'notifications',
      postgresUri: configService.getOrThrow('EVENT_BROKER_POSTGRES_URI'),
    }),
  ],
  providers: [
    NotificationCommandHandler,
    NotificationController,
    ConfigServiceProvider,
    NovuProvider,
    EmailSenderService,
    NotificationRouterService,
  ],
})
export class NotificationsModule {}
