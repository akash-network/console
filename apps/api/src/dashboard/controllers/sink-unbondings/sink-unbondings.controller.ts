import { singleton } from "tsyringe";

import { SinkUnbondingsResponse } from "@src/dashboard/http-schemas/sink-unbondings/sink-unbondings.schema";
import { StatsService } from "@src/dashboard/services/stats/stats.service";

@singleton()
export class SinkUnbondingsController {
  constructor(private readonly statsService: StatsService) {}

  async getUnbondings(): Promise<SinkUnbondingsResponse> {
    return await this.statsService.getSinkUnbondings();
  }
}
