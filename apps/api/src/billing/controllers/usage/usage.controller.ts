import { singleton } from "tsyringe";

import { UsageHistoryResponse, UsageHistoryStats } from "@src/billing/http-schemas/usage.schema";
import { UsageService } from "@src/billing/services/usage/usage.service";

@singleton()
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  async getHistory(address: string, startDate: string, endDate: string): Promise<UsageHistoryResponse> {
    return await this.usageService.getHistory(address, startDate, endDate);
  }

  async getHistoryStats(address: string, startDate: string, endDate: string): Promise<UsageHistoryStats> {
    return await this.usageService.getHistoryStats(address, startDate, endDate);
  }
}
