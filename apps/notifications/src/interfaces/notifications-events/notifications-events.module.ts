import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { BrokerModule } from "@src/infrastructure/broker";
import { NotificationHandler } from "@src/interfaces/notifications-events/handlers/notification/notification.handler";
import { NotificationsModule } from "@src/modules/notifications/notifications.module";

@Module({
  imports: [NotificationsModule, BrokerModule, ConfigModule.forRoot({ isGlobal: true })],
  providers: [NotificationHandler]
})
export default class NotificationsEventsModule {}
