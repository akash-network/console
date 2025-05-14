import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CommonModule } from "@src/common/common.module";
import { AlertModule } from "@src/modules/alert/alert.module";
import { NotificationsModule } from "@src/modules/notifications/notifications.module";
import { ContactPointController } from "./controllers/contact-point/contact-point.controller";
import { RawAlertController } from "./controllers/raw-alert/raw-alert.controller";

@Module({
  imports: [CommonModule, AlertModule, NotificationsModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [RawAlertController, ContactPointController]
})
export default class RestModule {}
