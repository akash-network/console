import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { GlobalEnvConfig, globalEnvSchema } from '@src/config/env.config';
import { BrokerModule } from '@src/infrastructure/broker';
import { ChainEventsHandler } from '@src/interfaces/alert-events/handlers/chain-events/chain-events.handler';
import { NotificationHandler } from '@src/interfaces/notifications-events/handlers/notification/notification.handler';
import { RawAlertController } from '@src/interfaces/rest/controllers/raw-alert/raw-alert.controller';
import RestModule from '@src/interfaces/rest/rest.module';
import { AlertModule } from '@src/modules/alert/alert.module';
import { ChainModule } from '@src/modules/chain/chain.module';
import { NotificationsModule } from '@src/modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      skipProcessEnv: true,
      validate: (config) => globalEnvSchema.parse(config),
    }),
    BrokerModule.registerAsync({
      useFactory: async (configService: ConfigService<GlobalEnvConfig>) => ({
        appName: configService.getOrThrow('APP_NAME'),
        postgresUri: configService.getOrThrow('EVENT_BROKER_POSTGRES_URI'),
      }),
      inject: [ConfigService],
    }),
    ChainModule,
    AlertModule,
    NotificationsModule,
    RestModule,
  ],
  providers: [ChainEventsHandler, NotificationHandler],
  controllers: [RawAlertController],
})
export default class AllModule {}
