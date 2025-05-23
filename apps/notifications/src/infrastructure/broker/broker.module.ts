import { DiscoveryModule } from "@golevelup/nestjs-discovery";
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CommonModule } from "@src/common/common.module";
import { DbProvider } from "@src/infrastructure/broker/providers/db/db.provider";
import { BrokerHealthzService } from "@src/infrastructure/broker/services/broker-healthz/broker-healthz.service";
import { PgBossHandlerService } from "@src/infrastructure/broker/services/pg-boss-handler/pg-boss-handler.service";
import { StateService } from "@src/infrastructure/broker/services/state/state.service";
import { PgBossProvider } from "./providers/pg-boss/pg-boss.provider";
import { BrokerService } from "./services/broker/broker.service";
import config from "./config";

@Global()
@Module({
  imports: [CommonModule, DiscoveryModule, ConfigModule.forFeature(config)],
  providers: [BrokerService, PgBossProvider, DbProvider, PgBossHandlerService, StateService, BrokerHealthzService],
  exports: [BrokerService, PgBossHandlerService, BrokerHealthzService]
})
export class BrokerModule {}
