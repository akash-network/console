import { secondsInMinute } from "date-fns";
import { inject, injectable } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { DB_HEALTHCHECK, DbHealthcheck, JOB_QUEUE_HEALTHCHECK, JobQueueHealthcheck } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";

@injectable()
export class HealthzService {
  constructor(
    @inject(DB_HEALTHCHECK) private readonly dbHealthcheck: DbHealthcheck,
    @inject(JOB_QUEUE_HEALTHCHECK) private readonly jobQueueHealthcheck: JobQueueHealthcheck,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(HealthzService.name);
  }

  async getReadinessStatus(): Promise<HealthzResult> {
    const [isPostgresReady, isJobQueueReady] = await Promise.all([this.isPostgresHealthy(), this.isJobQueueHealthy()]);

    return {
      status: isPostgresReady && isJobQueueReady ? "ok" : "error",
      data: {
        postgres: isPostgresReady,
        jobQueue: isJobQueueReady
      }
    };
  }

  async getLivenessStatus(): Promise<HealthzResult> {
    const [isPostgresAlive, isJobQueueAlive] = await Promise.all([this.isPostgresAlive(), this.isJobQueueAlive()]);

    return {
      status: isPostgresAlive && isJobQueueAlive ? "ok" : "error",
      data: {
        postgres: isPostgresAlive,
        jobQueue: isJobQueueAlive
      }
    };
  }

  @Memoize({ ttlInSeconds: secondsInMinute })
  private async isPostgresAlive() {
    return this.isPostgresHealthy();
  }

  @Memoize({ ttlInSeconds: secondsInMinute })
  private async isJobQueueAlive() {
    return this.isJobQueueHealthy();
  }

  private async isPostgresHealthy(): Promise<boolean> {
    try {
      await this.dbHealthcheck.ping();
      return true;
    } catch (error) {
      this.logger.error({
        event: "DB_HEALTHCHECK_ERROR",
        error
      });
      return false;
    }
  }

  private async isJobQueueHealthy() {
    try {
      await this.jobQueueHealthcheck.ping();
      return true;
    } catch (error) {
      this.logger.error({
        event: "JOB_QUEUE_HEALTHCHECK_ERROR",
        error
      });
      return false;
    }
  }
}

export interface HealthzResult {
  status: "ok" | "error";
  data: {
    postgres: boolean;
    jobQueue: boolean;
  };
}
