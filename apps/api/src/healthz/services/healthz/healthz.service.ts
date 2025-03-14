import { differenceInMilliseconds, millisecondsInMinute } from "date-fns";
import { sql } from "drizzle-orm";
import { injectable } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";
import { InjectPg } from "@src/core/providers/postgres.provider";
import { ApiPgDatabase } from "@src/core/providers/postgres.provider";
import type { HealthzResponse } from "@src/healthz/routes/healthz.router";

@injectable()
export class HealthzService {
  private dbFailedAt: Date | undefined;

  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(HealthzService.name);
  }

  async getReadinessStatus(): Promise<HealthzResponse & { status: "ok" | "error" }> {
    this.logger.info("foooo");
    const isPostgresReady = await this.isPostgresReady();

    return {
      status: isPostgresReady ? "ok" : "error",
      data: {
        postgres: isPostgresReady
      }
    };
  }

  async getLivenessStatus(threshold = millisecondsInMinute): Promise<HealthzResponse & { status: "ok" | "error" }> {
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

    const dbFailingFor = differenceInMilliseconds(new Date(), this.dbFailedAt);

    return dbFailingFor < threshold;
  }

  private async isPostgresConnected(): Promise<boolean> {
    try {
      await this.pg.execute(sql`SELECT 1`);
      this.dbFailedAt = undefined;

      return true;
    } catch (error) {
      this.dbFailedAt = this.dbFailedAt || new Date();
      this.logger.error(error);

      return false;
    }
  }
}
