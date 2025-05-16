import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ZodSerializerInterceptor } from "nestjs-zod";

import { CommonModule } from "@src/common/common.module";
import { AlertController } from "@src/interfaces/rest/controllers/alert/alert.controller";
import { AlertModule } from "@src/modules/alert/alert.module";
import { NotificationsModule } from "@src/modules/notifications/notifications.module";
import { ContactPointController } from "./controllers/contact-point/contact-point.controller";

@Module({
  imports: [CommonModule, AlertModule, NotificationsModule, ConfigModule.forRoot({ isGlobal: true })],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor }],
  controllers: [AlertController, ContactPointController]
})
export default class RestModule {}
