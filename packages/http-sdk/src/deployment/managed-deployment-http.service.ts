import type { AxiosRequestConfig } from "axios";

import { ApiHttpService } from "../api-http/api-http.service";

export interface WeeklyDeploymentCostResponse {
  weeklyCost: number;
}

export class ManagedDeploymentHttpService extends ApiHttpService {
  constructor(config?: Pick<AxiosRequestConfig, "baseURL">) {
    super(config);
  }

  /**
   * Get weekly deployment cost for all deployments with auto top-up enabled
   * @returns Weekly cost in USD
   */
  async getWeeklyDeploymentCost(): Promise<number> {
    const response = await this.extractApiData<WeeklyDeploymentCostResponse>(await this.get("/v1/weekly-cost"));
    return response.weeklyCost;
  }
}
