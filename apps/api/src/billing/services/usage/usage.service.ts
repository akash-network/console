import { singleton } from "tsyringe";

import { UsageHistoryResponse, UsageHistoryStats } from "@src/billing/http-schemas/usage.schema";
import { UsageRepository } from "@src/billing/repositories/usage/usage.repository";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";

@singleton()
export class UsageService {
  constructor(
    private readonly usageRepository: UsageRepository,
    private readonly leaseRepository: LeaseRepository
  ) {}

  async getHistory(address: string, startDate: string, endDate: string): Promise<UsageHistoryResponse> {
    return await this.usageRepository.getHistory(address, startDate, endDate);
  }

  async getHistoryStats(address: string, startDate: string, endDate: string): Promise<UsageHistoryStats> {
    const [historyData, totalLeases] = await Promise.all([
      this.usageRepository.getHistory(address, startDate, endDate),
      this.leaseRepository.countByOwner(address)
    ]);

    if (historyData.length === 0) {
      return {
        totalSpent: 0,
        averagePerDay: 0,
        totalLeases,
        averageLeasesPerDay: 0
      };
    }

    const totalSpent = historyData.at(-1)!.totalUsdSpent;
    const totalDailySpent = historyData.reduce((sum, day) => sum + day.dailyUsdSpent, 0);
    const averagePerDay = totalDailySpent / historyData.length;

    const averageDeploymentsPerDay = totalLeases / historyData.length;

    return {
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      averagePerDay: parseFloat(averagePerDay.toFixed(2)),
      totalLeases,
      averageLeasesPerDay: parseFloat(averageDeploymentsPerDay.toFixed(2))
    };
  }
}
