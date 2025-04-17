import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AlertModule } from '@src/alert/alert.module';
import { BrokerModule } from '@src/broker';
import { ChainEventsModule } from './chain-events/chain-events.module';
import { GlobalEnvConfig, globalEnvSchema } from './config/env.config';
import { NotificationsModule } from './notifications/notifications.module';

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
    ChainEventsModule,
    AlertModule,
    NotificationsModule,
  ],
})
export class AppModule {}
