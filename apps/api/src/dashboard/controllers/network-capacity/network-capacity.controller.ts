import { singleton } from "tsyringe";

import { NetworkCapacityResponse } from "../../http-schemas/network-capacity/network-capacity.schema";
import { StatsService } from "../../services/stats/stats.service";

@singleton()
export class NetworkCapacityController {
  constructor(private readonly statsService: StatsService) {}

  async getNetworkCapacity(): Promise<NetworkCapacityResponse> {
    return await this.statsService.getNetworkCapacity();
  }
}
