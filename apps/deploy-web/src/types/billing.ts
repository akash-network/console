export type ChosenPlan = {
  id: string;
  title: string;
};

export type UsageHistory = Array<{
  date: string;
  activeDeployments: number;
  dailyAktSpent: number;
  totalAktSpent: number;
  dailyUsdcSpent: number;
  totalUsdcSpent: number;
  dailyActSpent: number;
  totalActSpent: number;
  dailyUsdSpent: number;
  totalUsdSpent: number;
}>;

/** The gpu fields are absent from an api older than the gpu hours report, so the page can tell "not reported" from "no gpu used". */
export type UsageHistoryStats = {
  totalSpent: number;
  averageSpentPerDay: number;
  totalDeployments: number;
  averageDeploymentsPerDay: number;
  gpuHours?: number;
  gpuModels?: string[];
};
