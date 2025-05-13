import { Module } from "@nestjs/common";

import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import ChainEventsModule from "@src/interfaces/chain-events/chain-events.module";
import NotificationsEventsModule from "@src/interfaces/notifications-events/notifications-events.module";
import RestModule from "@src/interfaces/rest/rest.module";

@Module({
  imports: [ChainEventsModule, AlertEventsModule, NotificationsEventsModule, RestModule]
})
export default class AllModule {}
