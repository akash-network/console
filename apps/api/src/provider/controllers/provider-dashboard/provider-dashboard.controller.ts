import { singleton } from "tsyringe";

import { ProviderDashboardResponse } from "@src/provider/http-schemas/provider-dashboard.schema";
import { ProviderDashboardService } from "@src/provider/services/provider-dashboard/provider-dashboard.service";

@singleton()
export class ProviderDashboardController {
  constructor(private readonly providerDashboardService: ProviderDashboardService) {}

  async getProviderDashboard(owner: string): Promise<ProviderDashboardResponse> {
    return await this.providerDashboardService.getProviderDashboard(owner);
  }
}
