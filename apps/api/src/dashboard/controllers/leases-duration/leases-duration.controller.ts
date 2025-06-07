import { singleton } from "tsyringe";

import { LeasesDurationParams, LeasesDurationQuery, LeasesDurationResponse } from "@src/dashboard/http-schemas/leases-duration/leases-duration.schema";
import { StatsService } from "@src/dashboard/services/stats/stats.service";

@singleton()
export class LeasesDurationController {
  constructor(private readonly statsService: StatsService) {}

  async getLeasesDuration(owner: LeasesDurationParams["owner"], query: LeasesDurationQuery): Promise<LeasesDurationResponse> {
    return await this.statsService.getLeasesDuration(owner, query);
  }
}
