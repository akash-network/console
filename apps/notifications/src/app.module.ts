import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ChainEventsModule } from './chain-events/chain-events.module';
import { globalEnvSchema } from './config/env.config';
import { EventRoutingModule } from './event-routing/event-routing.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      skipProcessEnv: true,
      validate: (config) => globalEnvSchema.parse(config),
    }),
    ChainEventsModule,
    EventRoutingModule,
    NotificationsModule,
  ],
})
export class AppModule {}
