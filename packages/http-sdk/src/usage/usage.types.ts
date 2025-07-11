export type UsageHistory = Array<{
  date: string;
  activeDeployments: number;
  dailyAktSpent: number;
  totalAktSpent: number;
  dailyUsdcSpent: number;
  totalUsdcSpent: number;
  dailyUsdSpent: number;
  totalUsdSpent: number;
}>;

export type UsageHistoryStats = {
  totalSpent: number;
  averageSpentPerDay: number;
  totalDeployments: number;
  averageDeploymentsPerDay: number;
};
