import { singleton } from "tsyringe";

import { UsageHistoryResponse, UsageHistoryStats } from "@src/billing/http-schemas/usage.schema";
import { DeploymentSpendRepository } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import { UsageRepository } from "@src/billing/repositories/usage/usage.repository";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { GpuFormattingService } from "@src/gpu/services/gpu-formatting/gpu-formatting.service";

type GpuUsage = Pick<UsageHistoryStats, "gpuHours" | "gpuModels">;

@singleton()
export class UsageService {
  constructor(
    private readonly usageRepository: UsageRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly deploymentSpendRepository: DeploymentSpendRepository,
    private readonly gpuFormattingService: GpuFormattingService
  ) {}

  async getHistory(address: string, startDate: string, endDate: string): Promise<UsageHistoryResponse> {
    return await this.usageRepository.getHistory(address, startDate, endDate);
  }

  async getHistoryStats(address: string, startDate: string, endDate: string): Promise<UsageHistoryStats> {
    const [historyData, totalDeployments, gpuUsage] = await Promise.all([
      this.getHistory(address, startDate, endDate),
      this.deploymentRepository.countActiveByOwner(address, { startDate, endDate }),
      this.#gpuUsageOf(address, { startDate, endDate })
    ]);

    if (historyData.length === 0) {
      return {
        totalSpent: 0,
        averageSpentPerDay: 0,
        totalDeployments,
        averageDeploymentsPerDay: 0,
        ...gpuUsage
      };
    }

    const totalDailySpent = historyData.reduce((sum, day) => sum + day.dailyUsdSpent, 0);
    const averageSpentPerDay = totalDailySpent / historyData.length;

    const averageDeploymentsPerDay = totalDeployments / historyData.length;

    return {
      totalSpent: parseFloat(totalDailySpent.toFixed(2)),
      averageSpentPerDay: parseFloat(averageSpentPerDay.toFixed(2)),
      totalDeployments: totalDeployments,
      averageDeploymentsPerDay: parseFloat(averageDeploymentsPerDay.toFixed(2)),
      ...gpuUsage
    };
  }

  async #gpuUsageOf(address: string, range: { startDate: string; endDate: string }): Promise<GpuUsage> {
    const owners = await this.usageRepository.resolveAddresses(address);
    const usage = await this.deploymentSpendRepository.findGpuUsage({ owners, ...range });
    const gpuHours = usage.reduce((sum, { gpuHours }) => sum + gpuHours, 0);

    return {
      gpuHours: Math.round(gpuHours * 100) / 100,
      gpuModels: this.gpuFormattingService.formatModelNames(usage.flatMap(({ gpuModels }) => gpuModels))
    };
  }
}
