import { InjectDrizzle } from "@knaadh/nestjs-drizzle-pg";
import { Injectable } from "@nestjs/common";
import { differenceInMilliseconds } from "date-fns";
import { millisecondsInMinute } from "date-fns/constants";
import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { HealthzService, ProbeResult } from "@src/common/types/healthz.type";
import { DRIZZLE_PROVIDER_TOKEN } from "../../config/db.config";

@Injectable()
export class DbHealthzService implements HealthzService {
  name = "db";

  private dbFailedAt?: Date;

  constructor(
    @InjectDrizzle(DRIZZLE_PROVIDER_TOKEN)
    private readonly db: NodePgDatabase<any>,
    private readonly loggerService: LoggerService
  ) {
    loggerService.setContext(DbHealthzService.name);
  }

  async getReadinessStatus(): Promise<ProbeResult> {
    const isPostgresReady = await this.isPostgresReady();

    return {
      status: isPostgresReady ? "ok" : "error",
      data: {
        postgres: isPostgresReady
      }
    };
  }

  async getLivenessStatus(threshold = millisecondsInMinute): Promise<ProbeResult> {
    const isPostgresAlive = await this.isPostgresAlive(threshold);

    return {
      status: isPostgresAlive ? "ok" : "error",
      data: {
        postgres: isPostgresAlive
      }
    };
  }

  private async isPostgresReady() {
    return this.isPostgresConnected();
  }

  private async isPostgresAlive(threshold = millisecondsInMinute) {
    if (await this.isPostgresConnected()) {
      return true;
    }

    const dbFailingFor = this.dbFailedAt ? differenceInMilliseconds(new Date(), this.dbFailedAt) : 0;

    return dbFailingFor < threshold;
  }

  private async isPostgresConnected(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`);
      this.dbFailedAt = undefined;

      return true;
    } catch (error) {
      this.dbFailedAt = this.dbFailedAt || new Date();
      this.loggerService.error(error);

      return false;
    }
  }
}
