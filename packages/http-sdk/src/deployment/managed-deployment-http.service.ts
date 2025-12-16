import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";

export interface WeeklyDeploymentCostResponse {
  data: {
    weeklyCost: number;
  };
}

export class ManagedDeploymentHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Get weekly deployment cost for all deployments with auto top-up enabled
   * @returns Weekly cost in USD
   */
  async getWeeklyDeploymentCost(): Promise<number> {
    const response = await this.httpClient.get<WeeklyDeploymentCostResponse>("/v1/weekly-cost");
    return extractData(response).data.weeklyCost;
  }
}
