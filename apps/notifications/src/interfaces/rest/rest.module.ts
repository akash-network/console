import { MiddlewareConsumer, Module, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ZodSerializerInterceptor } from "nestjs-zod";

import { CommonModule } from "@src/common/common.module";
import { DeploymentAlertController } from "@src/interfaces/rest/controllers/deployment-alert/deployment-alert.controller";
import { HealthzController } from "@src/interfaces/rest/controllers/healthz/healthz.controller";
import { AlertModule } from "@src/modules/alert/alert.module";
import { NotificationsModule } from "@src/modules/notifications/notifications.module";
import { AlertController } from "./controllers/alert/alert.controller";
import { NotificationChannelController } from "./controllers/notification-channel/notification-channel.controller";
import { AuthInterceptor } from "./interceptors/auth/auth.interceptor";
import { LocalHttpLoggerMiddleware } from "./interceptors/http-logger/http-logger.middleware";
import { HttpResultInterceptor } from "./interceptors/http-result/http-result.interceptor";
import { AuthService } from "./services/auth/auth.service";

@Module({
  imports: [CommonModule, AlertModule, NotificationsModule, ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: HttpResultInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuthInterceptor },
    AuthService
  ],
  controllers: [AlertController, NotificationChannelController, DeploymentAlertController, HealthzController]
})
export default class RestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LocalHttpLoggerMiddleware).forRoutes({
      path: "*",
      method: RequestMethod.ALL
    });
  }
}
