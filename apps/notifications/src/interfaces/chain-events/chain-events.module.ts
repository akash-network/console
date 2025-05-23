import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CommonModule } from "@src/common/common.module";
import { WorkerHealthzController } from "@src/common/controllers/worker-healthz/worker-healthz.controller";
import { BrokerModule } from "@src/infrastructure/broker";
import { ChainModule } from "@src/modules/chain/chain.module";

@Module({
  imports: [CommonModule, ChainModule, BrokerModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [WorkerHealthzController]
})
export default class ChainEventsModule {}
