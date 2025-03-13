import { Module } from '@nestjs/common';

import { BrokerModule } from '@src/broker/broker.module';
import { CommonModule } from '@src/common/common.module';
import { ChainEventsController } from '@src/event-routing/controllers/chain-events/chain-events.controller';
import { ChainEventsHandler } from '@src/event-routing/handlers/chain-events/chain-events.handler';
import { EventMatchingService } from '@src/event-routing/services/event-matching/event-matching.service';
import { configService, ConfigServiceProvider } from './config/env.config';

@Module({
  imports: [
    CommonModule,
    BrokerModule.forRoot({
      appName: 'event-routing',
      postgresUri: configService.getOrThrow('EVENT_BROKER_POSTGRES_URI'),
    }),
  ],
  providers: [
    ChainEventsController,
    ChainEventsHandler,
    EventMatchingService,
    ConfigServiceProvider,
  ],
})
export class EventRoutingModule {}
