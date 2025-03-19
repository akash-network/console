import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BrokerModule } from '@src/broker/broker.module';
import { CommonModule } from '@src/common/common.module';
import { ChainEventsController } from '@src/event-routing/controllers/chain-events/chain-events.controller';
import { ChainEventsHandler } from '@src/event-routing/handlers/chain-events/chain-events.handler';
import { EventMatchingService } from '@src/event-routing/services/event-matching/event-matching.service';

@Module({
  imports: [
    CommonModule,
    BrokerModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        appName: 'event-routing',
        postgresUri: configService.getOrThrow('EVENT_BROKER_POSTGRES_URI'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ChainEventsController, ChainEventsHandler, EventMatchingService],
})
export class EventRoutingModule {}
