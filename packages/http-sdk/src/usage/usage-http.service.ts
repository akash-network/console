import { format } from "date-fns";

import { HttpService } from "../http/http.service";
import type { UsageHistory, UsageHistoryStats } from "./usage.types";

type UsageParams = {
  address: string;
  startDate?: Date;
  endDate?: Date;
};

export class UsageHttpService extends HttpService {
  async getUsage(params: UsageParams): Promise<UsageHistory> {
    return this.extractData(
      await this.get("/v1/usage/history", {
        params: this.normalizeUsageParams(params)
      })
    );
  }

  async getUsageStats(params: UsageParams): Promise<UsageHistoryStats> {
    return this.extractData(
      await this.get("/v1/usage/history/stats", {
        params: this.normalizeUsageParams(params)
      })
    );
  }

  private normalizeUsageParams(params: UsageParams): Record<string, string | undefined> {
    return {
      address: params.address,
      startDate: params.startDate ? format(params.startDate, "y-MM-dd") : undefined,
      endDate: params.endDate ? format(params.endDate, "y-MM-dd") : undefined
    };
  }
}
