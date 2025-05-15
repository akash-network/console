import { singleton } from "tsyringe";

import { ProviderGraphDataResponse } from "@src/provider/http-schemas/provider-graph-data.schema";
import { ProviderGraphDataService } from "@src/provider/services/provider-graph-data/provider-graph-data.service";
import { ProviderStatsKey } from "@src/types";

@singleton()
export class ProviderGraphDataController {
  constructor(private readonly providerGraphDataService: ProviderGraphDataService) {}

  async getProviderGraphData(dataName: ProviderStatsKey): Promise<ProviderGraphDataResponse> {
    return await this.providerGraphDataService.getProviderGraphData(dataName);
  }
}
