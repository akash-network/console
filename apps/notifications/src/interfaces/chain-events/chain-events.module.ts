import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { BrokerModule } from "@src/infrastructure/broker";
import { ChainModule } from "@src/modules/chain/chain.module";

@Module({
  imports: [ChainModule, BrokerModule, ConfigModule.forRoot({ isGlobal: true })]
})
export default class ChainEventsModule {}
