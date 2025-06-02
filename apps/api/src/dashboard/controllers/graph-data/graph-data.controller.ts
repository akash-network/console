import { singleton } from "tsyringe";

import { GraphDataResponse } from "@src/dashboard/http-schemas/graph-data/graph-data.schema";
import { StatsService } from "@src/dashboard/services/stats/stats.service";
import { AuthorizedGraphDataName } from "@src/services/db/statsService";

@singleton()
export class GraphDataController {
  constructor(private readonly statsService: StatsService) {}

  async getGraphData(dataName: AuthorizedGraphDataName): Promise<GraphDataResponse> {
    return await this.statsService.getGraphData(dataName);
  }
}
