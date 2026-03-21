const AuthorizedGraphDataNamesConst = [
  "dailyUAktSpent",
  "dailyUActSpent",
  "dailyUUsdSpent",
  "dailyLeaseCount",
  "totalUAktSpent",
  "totalUActSpent",
  "totalUUsdSpent",
  "activeLeaseCount",
  "totalLeaseCount",
  "activeCPU",
  "activeGPU",
  "activeMemory",
  "activeStorage",
  "gpuUtilization",
  "totalAktBurnedForAct",
  "dailyAktBurnedForAct",
  "totalActMinted",
  "dailyActMinted",
  "totalActBurnedForAkt",
  "dailyActBurnedForAkt",
  "totalAktReminted",
  "dailyAktReminted",
  "netAktBurned",
  "dailyNetAktBurned",
  "outstandingAct",
  "vaultAkt",
  "collateralRatio"
] as const;

export type AuthorizedGraphDataName = (typeof AuthorizedGraphDataNamesConst)[number];

export type DashboardGraphDataName = Extract<
  AuthorizedGraphDataName,
  | "dailyUAktSpent"
  | "dailyUActSpent"
  | "dailyUUsdSpent"
  | "dailyLeaseCount"
  | "totalUAktSpent"
  | "totalUActSpent"
  | "totalUUsdSpent"
  | "activeLeaseCount"
  | "totalLeaseCount"
  | "activeCPU"
  | "activeGPU"
  | "activeMemory"
  | "activeStorage"
>;

export const AuthorizedGraphDataNames: AuthorizedGraphDataName[] = [...AuthorizedGraphDataNamesConst];

export function isValidGraphDataName(x: string): x is AuthorizedGraphDataName {
  return AuthorizedGraphDataNames.includes(x as AuthorizedGraphDataName);
}
