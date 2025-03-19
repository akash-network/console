import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BrokerModule } from '@src/broker/broker.module';
import { CommonModule } from '@src/common/common.module';
import { GlobalEnvConfig } from '@src/config/env.config';
import { NotificationController } from './controllers/notification/notification.controller';
import { NotificationCommandHandler } from './handlers/notification-command/notification-command.handler';
import { NovuProvider } from './providers/novu.provider';
import { EmailSenderService } from './services/email-sender/email-sender.service';
import { NotificationRouterService } from './services/notification-router/notification-router.service';

@Module({
  imports: [
    CommonModule,
    BrokerModule.registerAsync({
      useFactory: async (configService: ConfigService<GlobalEnvConfig>) => ({
        appName: 'notifications',
        postgresUri: configService.getOrThrow('EVENT_BROKER_POSTGRES_URI'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    NotificationCommandHandler,
    NotificationController,
    NovuProvider,
    EmailSenderService,
    NotificationRouterService,
  ],
})
export class NotificationsModule {}
