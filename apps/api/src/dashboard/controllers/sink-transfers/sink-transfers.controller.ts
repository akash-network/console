import { singleton } from "tsyringe";

import { SinkTransfersQuery, SinkTransfersResponse } from "@src/dashboard/http-schemas/sink-transfers/sink-transfers.schema";
import { StatsService } from "@src/dashboard/services/stats/stats.service";

@singleton()
export class SinkTransfersController {
  constructor(private readonly statsService: StatsService) {}

  async getTransfers(query: SinkTransfersQuery): Promise<SinkTransfersResponse> {
    return await this.statsService.getSinkTransfers(query);
  }
}
