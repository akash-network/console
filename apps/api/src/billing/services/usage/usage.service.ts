import { singleton } from "tsyringe";

import { UsageHistoryResponse, UsageHistoryStats } from "@src/billing/http-schemas/usage.schema";
import { UsageRepository } from "@src/billing/repositories/usage/usage.repository";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { sleep } from "@src/utils/delay";
import mockHistoryData from "./mock-history-data";

@singleton()
export class UsageService {
  constructor(
    private readonly usageRepository: UsageRepository,
    private readonly deploymentRepository: DeploymentRepository
  ) {}

  async getHistory(address: string, startDate: string, endDate: string): Promise<UsageHistoryResponse> {
    // TODO: Revert back to real service call before merging
    if (process.env.NODE_ENV === "test") {
      return await this.usageRepository.getHistory(address, startDate, endDate);
    }

    await sleep(1000);

    return mockHistoryData.filter(data => {
      const date = new Date(data.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return date >= start && date <= end;
    });
  }

  async getHistoryStats(address: string, startDate: string, endDate: string): Promise<UsageHistoryStats> {
    const [historyData, totalDeployments] = await Promise.all([this.getHistory(address, startDate, endDate), this.deploymentRepository.countByOwner(address)]);
    // TODO: Remove this mock value before merging
    const totalDeploymentsToUse = process.env.NODE_ENV === "test" ? totalDeployments : historyData.reduce((sum, day) => sum + day.activeDeployments, 0);

    if (historyData.length === 0) {
      return {
        totalSpent: 0,
        averageSpentPerDay: 0,
        totalDeployments: totalDeploymentsToUse,
        averageDeploymentsPerDay: 0
      };
    }

    const totalDailySpent = historyData.reduce((sum, day) => sum + day.dailyUsdSpent, 0);
    const averageSpentPerDay = totalDailySpent / historyData.length;

    const averageDeploymentsPerDay = totalDeploymentsToUse / historyData.length;

    return {
      totalSpent: parseFloat(totalDailySpent.toFixed(2)),
      averageSpentPerDay: parseFloat(averageSpentPerDay.toFixed(2)),
      totalDeployments: totalDeploymentsToUse,
      averageDeploymentsPerDay: parseFloat(averageDeploymentsPerDay.toFixed(2))
    };
  }
}
