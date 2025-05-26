import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CommonModule } from "@src/common/common.module";
import { WorkerHealthzController } from "@src/common/controllers/worker-healthz/worker-healthz.controller";
import { BrokerModule } from "@src/infrastructure/broker";
import { NotificationHandler } from "@src/interfaces/notifications-events/handlers/notification/notification.handler";
import { NotificationsModule } from "@src/modules/notifications/notifications.module";

@Module({
  imports: [CommonModule, NotificationsModule, BrokerModule, ConfigModule.forRoot({ isGlobal: true })],
  providers: [NotificationHandler],
  controllers: [WorkerHealthzController]
})
export default class NotificationsEventsModule {}
