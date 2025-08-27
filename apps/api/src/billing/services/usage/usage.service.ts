import { singleton } from "tsyringe";

import { UsageHistoryResponse, UsageHistoryStats } from "@src/billing/http-schemas/usage.schema";
import { UsageRepository } from "@src/billing/repositories/usage/usage.repository";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";

@singleton()
export class UsageService {
  constructor(
    private readonly usageRepository: UsageRepository,
    private readonly deploymentRepository: DeploymentRepository
  ) {}

  async getHistory(address: string, startDate: string, endDate: string): Promise<UsageHistoryResponse> {
    return await this.usageRepository.getHistory(address, startDate, endDate);
  }

  async getHistoryStats(address: string, startDate: string, endDate: string): Promise<UsageHistoryStats> {
    const [historyData, totalDeployments] = await Promise.all([
      this.getHistory(address, startDate, endDate),
      this.deploymentRepository.countByOwner(address, startDate, endDate)
    ]);

    if (historyData.length === 0) {
      return {
        totalSpent: 0,
        averageSpentPerDay: 0,
        totalDeployments,
        averageDeploymentsPerDay: 0
      };
    }

    const totalDailySpent = historyData.reduce((sum, day) => sum + day.dailyUsdSpent, 0);
    const averageSpentPerDay = totalDailySpent / historyData.length;

    const averageDeploymentsPerDay = totalDeployments / historyData.length;

    return {
      totalSpent: parseFloat(totalDailySpent.toFixed(2)),
      averageSpentPerDay: parseFloat(averageSpentPerDay.toFixed(2)),
      totalDeployments: totalDeployments,
      averageDeploymentsPerDay: parseFloat(averageDeploymentsPerDay.toFixed(2))
    };
  }

  async getTotalUsageData(address: string): Promise<{
    totalAktSpent: number;
    totalUsdcSpent: number;
    totalUsdSpent: number;
  }> {
    return await this.usageRepository.getTotalUsageData(address);
  }

  async getActiveLeasesCount(address: string): Promise<number> {
    return await this.usageRepository.getActiveLeasesCount(address);
  }
}
