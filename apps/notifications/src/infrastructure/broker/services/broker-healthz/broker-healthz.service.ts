import { Injectable } from "@nestjs/common";
import { differenceInMilliseconds } from "date-fns";
import { millisecondsInMinute } from "date-fns/constants";
import { Pool } from "pg";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { HealthzService, ProbeResult } from "@src/common/types/healthz.type";
import { StateService } from "@src/infrastructure/broker/services/state/state.service";

@Injectable()
export class BrokerHealthzService implements HealthzService {
  name = "broker";

  private dbFailedAt?: Date;

  constructor(
    private readonly stateService: StateService,
    private readonly db: Pool,
    private readonly loggerService: LoggerService
  ) {}

  async getReadinessStatus(): Promise<ProbeResult> {
    const isPostgresReady = await this.isPostgresReady();
    const isBrokerReady = this.stateService.getState() === "active";

    return {
      status: isPostgresReady && isBrokerReady ? "ok" : "error",
      data: {
        postgres: isPostgresReady,
        broker: isBrokerReady
      }
    };
  }

  async getLivenessStatus(threshold = millisecondsInMinute): Promise<ProbeResult> {
    const isPostgresAlive = await this.isPostgresAlive(threshold);
    const isBrokerReady = this.stateService.getState() === "active";

    return {
      status: isPostgresAlive ? "ok" : "error",
      data: {
        postgres: isPostgresAlive,
        broker: isBrokerReady
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
      await this.db.query("SELECT 1");
      this.dbFailedAt = undefined;

      return true;
    } catch (error) {
      this.dbFailedAt = this.dbFailedAt || new Date();
      this.loggerService.error(error);

      return false;
    }
  }
}
