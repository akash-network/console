import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { Pool } from "pg";
import { PgBoss } from "pg-boss";

import { PgBossHandlerService } from "@src/infrastructure/broker/services/pg-boss-handler/pg-boss-handler.service";

@Injectable()
export class StateService implements OnApplicationBootstrap, OnApplicationShutdown {
  private state: "active" | "stopped" = "stopped";

  constructor(
    private readonly pgBossHandlerService: PgBossHandlerService,
    private readonly pg: Pool,
    private readonly boss: PgBoss
  ) {
    boss.on("stopped", () => {
      this.state = "stopped";
    });
  }

  getState() {
    return this.state;
  }

  async onApplicationBootstrap() {
    await this.pgBossHandlerService.startAllHandlers();
    this.state = "active";
  }

  async onApplicationShutdown() {
    await this.boss.stop();
    await this.pg.end();
    this.state = "stopped";
  }
}
