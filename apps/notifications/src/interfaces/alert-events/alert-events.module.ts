import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { BrokerModule } from "@src/infrastructure/broker";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import { AlertModule } from "@src/modules/alert/alert.module";

@Module({
  imports: [BrokerModule, AlertModule, ConfigModule.forRoot({ isGlobal: true })],
  providers: [ChainEventsHandler]
})
export default class AlertEventsModule {}
