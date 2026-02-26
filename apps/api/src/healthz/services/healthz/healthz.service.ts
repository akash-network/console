import { millisecondsInMinute } from "date-fns";
import { clearTimeout } from "timers";
import { inject, singleton } from "tsyringe";

import type { DbHealthcheck, JobQueueHealthcheck } from "@src/core";
import { DB_HEALTHCHECK, JOB_QUEUE_HEALTHCHECK } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";
import { HealthzConfigService } from "@src/healthz/services/healthz-config/healthz-config.service";

@singleton()
export class HealthzService {
  private readonly healthchecks: Healthcheck[] = [];

  constructor(
    @inject(DB_HEALTHCHECK) dbHealthcheck: DbHealthcheck,
    @inject(JOB_QUEUE_HEALTHCHECK) jobQueueHealthcheck: JobQueueHealthcheck,
    private readonly healthzConfigService: HealthzConfigService,
    logger: LoggerService
  ) {
    logger.setContext(HealthzService.name);
    this.healthchecks.push(
      new Healthcheck("postgres", dbHealthcheck, logger, {
        cacheTTL: millisecondsInMinute,
        healthzTimeoutSeconds: healthzConfigService.get("HEALTHZ_TIMEOUT_SECONDS")
      })
    );
    this.healthchecks.push(
      new Healthcheck("jobQueue", jobQueueHealthcheck, logger, {
        cacheTTL: millisecondsInMinute,
        healthzTimeoutSeconds: healthzConfigService.get("HEALTHZ_TIMEOUT_SECONDS")
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

type LogStartAndTimeoutResult = { done: () => void };

class Healthcheck {
  private checkedAt: Date | null = null;
  private hasSucceeded = false;
  private isFailed = false;
  private inflightPing?: Promise<void>;

  constructor(
    public readonly name: string,
    private readonly healthchecker: Pick<DbHealthcheck | JobQueueHealthcheck, "ping">,
    private readonly logger: LoggerService,
    private readonly options: {
      cacheTTL: number;
      healthzTimeoutSeconds: number;
    }
  ) {}

  async isHealthy(options?: { ignoreCache?: boolean }): Promise<boolean> {
    let logStartAndTimeoutResult: LogStartAndTimeoutResult | undefined;
    const now = Date.now();

    try {
      if (options?.ignoreCache || !this.checkedAt || now - this.checkedAt.getTime() > this.options.cacheTTL) {
        logStartAndTimeoutResult = this.logStartAndTimeout();
        await this.check();
        this.hasSucceeded = true;
        this.isFailed = false;
      }

      return true;
    } catch (error) {
      this.logger.error({
        event: `${this.name.toUpperCase()}_HEALTHCHECK_ERROR`,
        error
      });

      const prevIsFailed = this.isFailed;
      if (prevIsFailed || !this.hasSucceeded || options?.ignoreCache) return false;

      this.isFailed = true;
      // tolerate failure for the 1st time and wait for the cache to expire until the next check
      return true;
    } finally {
      logStartAndTimeoutResult?.done();
    }
  }

  private logStartAndTimeout() {
    this.logger.info({ event: "HEALTHCHECK_STARTED", name: this.name, status: this.isFailed });
    const timeout = setTimeout(() => {
      this.logger.error({ event: "HEALTHCHECK_TIMEOUT", name: this.name });
    }, this.options.healthzTimeoutSeconds * 1000);

    return { done: () => clearTimeout(timeout) };
  }

  private check() {
    this.inflightPing ??= this.healthchecker.ping().finally(() => {
      this.checkedAt = new Date();
      this.inflightPing = undefined;
    });

    return this.inflightPing;
  }
}
