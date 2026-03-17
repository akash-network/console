import { singleton } from "tsyringe";

import { BmeDashboardDataResponse } from "@src/dashboard/http-schemas/bme-dashboard-data/bme-dashboard-data.schema";
import { StatsService } from "@src/dashboard/services/stats/stats.service";

@singleton()
export class BmeDashboardDataController {
  constructor(private readonly statsService: StatsService) {}

  async getDashboardData(): Promise<BmeDashboardDataResponse> {
    return await this.statsService.getBmeDashboardData();
  }
}
