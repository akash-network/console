import { Module } from '@nestjs/common';

import { CommonModule } from '@src/common/common.module';
import { NotificationController } from './controllers/notification/notification.controller';
import { NovuProvider } from './providers/novu.provider';
import { EmailSenderService } from './services/email-sender/email-sender.service';
import { NotificationRouterService } from './services/notification-router/notification-router.service';

@Module({
  imports: [CommonModule],
  providers: [
    NotificationController,
    NovuProvider,
    EmailSenderService,
    NotificationRouterService,
  ],
})
export class NotificationsModule {}
