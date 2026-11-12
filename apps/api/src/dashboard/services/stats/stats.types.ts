const SinkGraphDataNamesConst = [
  "sinkMintedUakt",
  "dailySinkMintedUakt",
  "sinkMintedTransfers",
  "dailySinkMintedTransfers",
  "sinkPendingUakt",
  "sinkVoidedUakt",
  "sinkRefundPendingUakt",
  "sinkRefundedUakt",
  "sinkUniqueSenders"
] as const;

const AuthorizedGraphDataNamesConst = [
  "dailyUAktSpent",
  "dailyUActSpent",
  "dailyUUsdcSpent",
  "dailyUUsdSpent",
  "dailyLeaseCount",
  "totalUAktSpent",
  "totalUActSpent",
  "totalUUsdcSpent",
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
  "collateralRatio",
  ...SinkGraphDataNamesConst
] as const;

export type AuthorizedGraphDataName = (typeof AuthorizedGraphDataNamesConst)[number];

export type SinkGraphDataName = (typeof SinkGraphDataNamesConst)[number];

export type DashboardGraphDataName = Extract<
  AuthorizedGraphDataName,
  | "dailyUAktSpent"
  | "dailyUActSpent"
  | "dailyUUsdcSpent"
  | "dailyUUsdSpent"
  | "dailyLeaseCount"
  | "totalUAktSpent"
  | "totalUActSpent"
  | "totalUUsdcSpent"
  | "totalUUsdSpent"
  | "activeLeaseCount"
  | "totalLeaseCount"
  | "activeCPU"
  | "activeGPU"
  | "activeMemory"
  | "activeStorage"
>;

export const AuthorizedGraphDataNames: AuthorizedGraphDataName[] = [...AuthorizedGraphDataNamesConst];

export function isSinkGraphDataName(x: AuthorizedGraphDataName): x is SinkGraphDataName {
  return SinkGraphDataNamesConst.some(name => name === x);
}

export function isValidGraphDataName(x: string): x is AuthorizedGraphDataName {
  return AuthorizedGraphDataNames.includes(x as AuthorizedGraphDataName);
}
