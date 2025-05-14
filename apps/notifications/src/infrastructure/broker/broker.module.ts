import { DiscoveryModule } from "@golevelup/nestjs-discovery";
import { Global, Module, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Client } from "pg";
import PgBoss from "pg-boss";

import { CommonModule } from "@src/common/common.module";
import { DbProvider } from "@src/infrastructure/broker/providers/db/db.provider";
import { PgBossHandlerService } from "@src/infrastructure/broker/services/pg-boss-handler/pg-boss-handler.service";
import { PgBossProvider } from "./providers/pg-boss/pg-boss.provider";
import { BrokerService } from "./services/broker/broker.service";
import config from "./config";

@Global()
@Module({
  imports: [CommonModule, DiscoveryModule, ConfigModule.forFeature(config)],
  providers: [BrokerService, PgBossProvider, DbProvider, PgBossHandlerService],
  exports: [BrokerService, PgBossHandlerService]
})
export class BrokerModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    private readonly pgBossHandlerService: PgBossHandlerService,
    private readonly pg: Client,
    private readonly boss: PgBoss
  ) {}

  async onApplicationBootstrap() {
    await this.pgBossHandlerService.startAllHandlers();
  }

  async onApplicationShutdown() {
    await this.boss.stop();
    await this.pg.end();
  }
}
