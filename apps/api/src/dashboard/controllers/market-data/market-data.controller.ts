import { singleton } from "tsyringe";

import { MarketDataParams, MarketDataResponse } from "@src/dashboard/http-schemas/market-data/market-data.schema";
import { StatsService } from "@src/dashboard/services/stats/stats.service";

@singleton()
export class MarketDataController {
  constructor(private readonly statsService: StatsService) {}

  async getMarketData(coin: MarketDataParams["coin"]): Promise<MarketDataResponse> {
    return await this.statsService.getMarketData(coin);
  }
}
