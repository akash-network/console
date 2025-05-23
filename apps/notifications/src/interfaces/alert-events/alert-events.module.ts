import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CommonModule } from "@src/common/common.module";
import { WorkerHealthzController } from "@src/common/controllers/worker-healthz/worker-healthz.controller";
import { BrokerModule } from "@src/infrastructure/broker";
import { ChainEventsHandler } from "@src/interfaces/alert-events/handlers/chain-events/chain-events.handler";
import { AlertModule } from "@src/modules/alert/alert.module";

@Module({
  imports: [BrokerModule, AlertModule, CommonModule, ConfigModule.forRoot({ isGlobal: true })],
  providers: [ChainEventsHandler],
  controllers: [WorkerHealthzController]
})
export default class AlertEventsModule {}
