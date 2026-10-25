import type { AxiosRequestConfig } from "axios";

import { HttpService } from "../http/http.service";
import type { UsageHistory, UsageHistoryStats } from "./usage.types";

/** Dates are YYYY-MM-DD UTC days, the days the api counts usage by. */
type UsageParams = {
  address: string;
  startDate?: string;
  endDate?: string;
};

export class UsageHttpService extends HttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  async getUsage(params: UsageParams): Promise<UsageHistory> {
    return this.extractData(await this.get("/v1/usage/history", { params }));
  }

  async getUsageStats(params: UsageParams): Promise<UsageHistoryStats> {
    return this.extractData(await this.get("/v1/usage/history/stats", { params }));
  }
}
