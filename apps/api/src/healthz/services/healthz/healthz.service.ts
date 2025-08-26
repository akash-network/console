import { millisecondsInMinute } from "date-fns";
import { inject, injectable } from "tsyringe";

import { DB_HEALTHCHECK, DbHealthcheck, JOB_QUEUE_HEALTHCHECK, JobQueueHealthcheck } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";

@injectable()
export class HealthzService {
  private readonly healthchecks: Healthcheck[] = [];

  constructor(
    @inject(DB_HEALTHCHECK) dbHealthcheck: DbHealthcheck,
    @inject(JOB_QUEUE_HEALTHCHECK) jobQueueHealthcheck: JobQueueHealthcheck,
    logger: LoggerService
  ) {
    logger.setContext(HealthzService.name);
    this.healthchecks.push(
      new Healthcheck("postgres", dbHealthcheck, logger, {
        cacheTTL: millisecondsInMinute
      })
    );
    this.healthchecks.push(
      new Healthcheck("jobQueue", jobQueueHealthcheck, logger, {
        cacheTTL: millisecondsInMinute
      })
    );
  }

  async getReadinessStatus(): Promise<HealthzResult> {
    const results = await Promise.all(this.healthchecks.map(healthcheck => healthcheck.isHealthy({ ignoreCache: true })));
    return this.buildResult(results);
  }

  async getLivenessStatus(): Promise<HealthzResult> {
    const results = await Promise.all(this.healthchecks.map(healthcheck => healthcheck.isHealthy()));
    return this.buildResult(results);
  }

  private buildResult(results: boolean[]): HealthzResult {
    return {
      status: results.every(Boolean) ? "ok" : "error",
      data: results.reduce(
        (acc, result, index) => {
          acc[this.healthchecks[index].name as keyof HealthzResult["data"]] = result;
          return acc;
        },
        {} as HealthzResult["data"]
      )
    };
  }
}

export interface HealthzResult {
  status: "ok" | "error";
  data: {
    postgres: boolean;
    jobQueue: boolean;
  };
}

class Healthcheck {
  private checkedAt: Date | null = null;
  private isFailed: boolean | null = null;
  private inflightPing?: Promise<void>;

  constructor(
    public readonly name: string,
    private readonly healthchecker: Pick<DbHealthcheck | JobQueueHealthcheck, "ping">,
    private readonly logger: LoggerService,
    private readonly options: {
      cacheTTL: number;
    }
  ) {}

  async isHealthy(options?: { ignoreCache?: boolean }): Promise<boolean> {
    const now = Date.now();

    try {
      if (options?.ignoreCache || !this.checkedAt || now - this.checkedAt.getTime() > this.options.cacheTTL) {
        await this.check();
        this.isFailed = false;
      }

      return true;
    } catch (error) {
      this.logger.error({
        event: `${this.name.toUpperCase()}_HEALTHCHECK_ERROR`,
        error
      });

      const prevIsFailed = this.isFailed;
      if (this.isFailed === null || prevIsFailed || options?.ignoreCache) return false;

      this.isFailed = true;
      // tolerate failure for the 1st time and wait for the cache to expire until the next check
      return true;
    }
  }

  private check() {
    this.inflightPing ??= this.healthchecker.ping().finally(() => {
      this.checkedAt = new Date();
      this.inflightPing = undefined;
    });

    return this.inflightPing;
  }
}
