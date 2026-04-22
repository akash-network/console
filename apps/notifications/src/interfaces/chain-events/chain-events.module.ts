import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CommonModule } from "@src/common/common.module";
import { BrokerModule } from "@src/infrastructure/broker";
import { HealthzController } from "@src/interfaces/chain-events/controllers/healthz/healthz.controller";
import { ChainModule } from "@src/modules/chain/chain.module";

@Module({
  imports: [CommonModule, ChainModule, BrokerModule, ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true })],
  controllers: [HealthzController]
})
export default class ChainEventsModule {}
