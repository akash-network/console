import { singleton } from "tsyringe";

import { SinkDashboardDataResponse } from "@src/dashboard/http-schemas/sink-dashboard-data/sink-dashboard-data.schema";
import { StatsService } from "@src/dashboard/services/stats/stats.service";

@singleton()
export class SinkDashboardDataController {
  constructor(private readonly statsService: StatsService) {}

  async getDashboardData(): Promise<SinkDashboardDataResponse> {
    return await this.statsService.getSinkDashboardData();
  }
}
