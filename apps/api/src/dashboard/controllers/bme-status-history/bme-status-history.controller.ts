import { singleton } from "tsyringe";

import { BmeStatusHistoryResponse } from "@src/dashboard/http-schemas/bme-status-history/bme-status-history.schema";
import { StatsService } from "@src/dashboard/services/stats/stats.service";

@singleton()
export class BmeStatusHistoryController {
  constructor(private readonly statsService: StatsService) {}

  async getStatusHistory(): Promise<BmeStatusHistoryResponse> {
    return await this.statsService.getBmeStatusHistory();
  }
}
