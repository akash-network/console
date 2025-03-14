import { Module } from '@nestjs/common';

import { ChainEventsModule } from '@src/chain-events/chain-events.module';
import { EventRoutingModule } from '@src/event-routing/event-routing.module';
import { NotificationsModule } from '@src/notifications/notifications.module';

@Module({
  imports: [EventRoutingModule, ChainEventsModule, NotificationsModule],
})
export class AppModule {}
