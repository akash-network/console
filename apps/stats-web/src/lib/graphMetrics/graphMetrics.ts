import { formatBytes, formatCompact, formatNumber, formatUsd } from "@/lib/statsFormat/statsFormat";
import type { BmeDashboardData, DashboardData, SinkDashboardData } from "@/types";
import {
  BmeSnapshots,
  BmeSnapshotsUrlParam,
  ProviderSnapshots,
  ProviderSnapshotsUrlParam,
  SinkSnapshots,
  SinkSnapshotsUrlParam,
  Snapshots,
  SnapshotsUrlParam
} from "@/types/snapshots";

export type GraphKind = "graph" | "provider-graph" | "bme-graph" | "solana-migration-graph";

export type GraphSources = {
  dashboard?: DashboardData;
  bme?: BmeDashboardData;
  sink?: SinkDashboardData;
};

export type GraphMetric = {
  kind: GraphKind;
  urlParam: string;
  snapshot: string;
  group: string;
  label: string;
  title: string;
  description: string;
  csvUnit: string;
  scale: (value: number) => number;
  formatValue: (value: number) => string;
  formatAxisValue: (value: number) => string;
  readCurrent: (sources: GraphSources) => number | undefined;
};

const asIs = (value: number) => value;
const fromMicro = (value: number) => value / 1e6;
const fromMilli = (value: number) => value / 1000;
const usd = {
  csvUnit: "USD",
  scale: fromMicro,
  formatValue: (value: number) => formatUsd(value),
  formatAxisValue: (value: number) => formatUsd(value, { compact: true })
};
const count = { csvUnit: "count", scale: asIs, formatValue: formatNumber, formatAxisValue: formatCompact };
const vcpu = { csvUnit: "vCPU", scale: fromMilli, formatValue: (value: number) => `${formatNumber(value)} vCPU`, formatAxisValue: formatCompact };
const bytes = { csvUnit: "bytes", scale: asIs, formatValue: formatBytes, formatAxisValue: formatBytes };
const tokens = (denom: string) => ({
  csvUnit: denom,
  scale: fromMicro,
  formatValue: (value: number) => `${formatCompact(value)} ${denom}`,
  formatAxisValue: formatCompact
});
const ratio = { csvUnit: "ratio", scale: asIs, formatValue: (value: number) => value.toFixed(2), formatAxisValue: (value: number) => value.toFixed(2) };

const fromNow = (read: (now: DashboardData["now"]) => number) => (sources: GraphSources) => (sources.dashboard?.now ? read(sources.dashboard.now) : undefined);
const fromCapacity = (read: (capacity: DashboardData["networkCapacity"]) => number) => (sources: GraphSources) =>
  sources.dashboard?.networkCapacity ? read(sources.dashboard.networkCapacity) : undefined;
const fromBme = (key: BmeSnapshots) => (sources: GraphSources) => sources.bme?.now?.[key];

const graph = (urlParam: SnapshotsUrlParam, snapshot: Snapshots) => ({ kind: "graph" as const, urlParam, snapshot });
const providerGraph = (urlParam: ProviderSnapshotsUrlParam, snapshot: ProviderSnapshots) => ({ kind: "provider-graph" as const, urlParam, snapshot });
const bmeGraph = (urlParam: BmeSnapshotsUrlParam, snapshot: BmeSnapshots) => ({ kind: "bme-graph" as const, urlParam, snapshot });
const solanaMigrationGraph = (key: keyof typeof SinkSnapshots) => ({
  kind: "solana-migration-graph" as const,
  urlParam: SinkSnapshotsUrlParam[key],
  snapshot: SinkSnapshots[key]
});

export const GRAPH_METRICS: GraphMetric[] = [
  {
    ...graph(SnapshotsUrlParam.dailyUsdSpent, Snapshots.dailyUUsdSpent),
    ...usd,
    group: "Spend",
    label: "Daily spend",
    title: "Daily spend (USD)",
    description: "USD paid to providers per day across all leases, with ACT and AKT converted to USD.",
    readCurrent: fromNow(now => fromMicro(now.dailyUUsdSpent))
  },
  {
    ...graph(SnapshotsUrlParam.totalUSDSpent, Snapshots.totalUUsdSpent),
    ...usd,
    group: "Spend",
    label: "Total spend",
    title: "Total spend (USD)",
    description: "Cumulative USD paid to providers since the marketplace launched in March 2021.",
    readCurrent: fromNow(now => fromMicro(now.totalUUsdSpent))
  },
  {
    ...graph(SnapshotsUrlParam.dailyActSpent, Snapshots.dailyUActSpent),
    ...tokens("ACT"),
    group: "Spend",
    label: "Daily ACT spend",
    title: "Daily ACT spent",
    description: "ACT paid to providers per day. Includes historical USDC at 1:1.",
    readCurrent: fromNow(now => fromMicro(now.dailyUActSpent))
  },
  {
    ...graph(SnapshotsUrlParam.totalACTSpent, Snapshots.totalUActSpent),
    ...tokens("ACT"),
    group: "Spend",
    label: "Total ACT spend",
    title: "Total ACT spent",
    description: "Cumulative ACT paid to providers. Includes historical USDC at 1:1.",
    readCurrent: fromNow(now => fromMicro(now.totalUActSpent))
  },
  {
    ...graph(SnapshotsUrlParam.dailyAktSpent, Snapshots.dailyUAktSpent),
    ...tokens("AKT"),
    group: "Spend",
    label: "Daily AKT spend",
    title: "Daily AKT spent",
    description: "AKT paid to providers per day.",
    readCurrent: fromNow(now => fromMicro(now.dailyUAktSpent))
  },
  {
    ...graph(SnapshotsUrlParam.totalAKTSpent, Snapshots.totalUAktSpent),
    ...tokens("AKT"),
    group: "Spend",
    label: "Total AKT spend",
    title: "Total AKT spent",
    description: "Cumulative AKT paid to providers since the marketplace launched in March 2021.",
    readCurrent: fromNow(now => fromMicro(now.totalUAktSpent))
  },
  {
    ...graph(SnapshotsUrlParam.activeLeases, Snapshots.activeLeaseCount),
    ...count,
    group: "Leases",
    label: "Active leases",
    title: "Active leases",
    description: "Workloads running on the network right now, from websites to blockchain nodes and GPU inference.",
    readCurrent: fromNow(now => now.activeLeaseCount)
  },
  {
    ...graph(SnapshotsUrlParam.dailyDeploymentCount, Snapshots.dailyLeaseCount),
    ...count,
    group: "Leases",
    label: "New leases / day",
    title: "New leases per day",
    description: "Fresh deployments matched with providers each day.",
    readCurrent: fromNow(now => now.dailyLeaseCount)
  },
  {
    ...graph(SnapshotsUrlParam.allTimeDeploymentCount, Snapshots.totalLeaseCount),
    ...count,
    group: "Leases",
    label: "Total leases",
    title: "Total leases (all-time)",
    description: "Every lease that was live and paid for at some point, including short tests.",
    readCurrent: fromNow(now => now.totalLeaseCount)
  },
  {
    ...graph(SnapshotsUrlParam.graphics, Snapshots.activeGPU),
    ...count,
    group: "Resources leased",
    label: "GPUs leased",
    title: "GPUs under lease",
    description: "GPUs under active lease across all providers.",
    readCurrent: fromNow(now => now.activeGPU)
  },
  {
    ...graph(SnapshotsUrlParam.compute, Snapshots.activeCPU),
    ...vcpu,
    group: "Resources leased",
    label: "CPU leased",
    title: "CPU under lease",
    description: "vCPUs under active lease across all providers.",
    readCurrent: fromNow(now => fromMilli(now.activeCPU))
  },
  {
    ...graph(SnapshotsUrlParam.memory, Snapshots.activeMemory),
    ...bytes,
    group: "Resources leased",
    label: "Memory leased",
    title: "Memory under lease",
    description: "Memory under active lease across all providers.",
    readCurrent: fromNow(now => now.activeMemory)
  },
  {
    ...graph(SnapshotsUrlParam.storage, Snapshots.activeStorage),
    ...bytes,
    group: "Resources leased",
    label: "Storage leased",
    title: "Storage under lease",
    description: "Disk storage under active lease across all providers.",
    readCurrent: fromNow(now => now.activeStorage)
  },
  {
    ...providerGraph(ProviderSnapshotsUrlParam.count, ProviderSnapshots.count),
    ...count,
    group: "Network capacity",
    label: "Active providers",
    title: "Active providers",
    description: "Providers online and serving the marketplace.",
    readCurrent: fromCapacity(capacity => capacity.activeProviderCount)
  },
  {
    ...providerGraph(ProviderSnapshotsUrlParam.gpu, ProviderSnapshots.gpu),
    ...count,
    group: "Network capacity",
    label: "GPU capacity",
    title: "GPU capacity",
    description: "GPUs offered by all active providers, leased or idle.",
    readCurrent: fromCapacity(capacity => capacity.totalGPU)
  },
  {
    ...providerGraph(ProviderSnapshotsUrlParam.cpu, ProviderSnapshots.cpu),
    ...vcpu,
    group: "Network capacity",
    label: "CPU capacity",
    title: "CPU capacity",
    description: "vCPUs offered by all active providers, leased or idle.",
    readCurrent: fromCapacity(capacity => fromMilli(capacity.totalCPU))
  },
  {
    ...providerGraph(ProviderSnapshotsUrlParam.memory, ProviderSnapshots.memory),
    ...bytes,
    group: "Network capacity",
    label: "Memory capacity",
    title: "Memory capacity",
    description: "Memory offered by all active providers, leased or idle.",
    readCurrent: fromCapacity(capacity => capacity.totalMemory)
  },
  {
    ...providerGraph(ProviderSnapshotsUrlParam.storage, ProviderSnapshots.storage),
    ...bytes,
    group: "Network capacity",
    label: "Storage capacity",
    title: "Storage capacity",
    description: "Disk storage offered by all active providers, leased or idle.",
    readCurrent: fromCapacity(capacity => capacity.totalStorage)
  },
  ...bmeMetrics(),
  ...solanaMigrationMetrics()
];

function bmeMetrics(): GraphMetric[] {
  const definitions: [BmeSnapshotsUrlParam, BmeSnapshots, string, string, string][] = [
    [BmeSnapshotsUrlParam.outstandingAct, BmeSnapshots.outstandingAct, "ACT", "Outstanding ACT", "ACT minted and not yet burned back into AKT."],
    [BmeSnapshotsUrlParam.vaultAkt, BmeSnapshots.vaultAkt, "AKT", "Vault AKT balance", "AKT held in the vault as collateral for outstanding ACT."],
    [BmeSnapshotsUrlParam.collateralRatio, BmeSnapshots.collateralRatio, "ratio", "Collateral ratio", "Vault AKT value over outstanding ACT."],
    [BmeSnapshotsUrlParam.dailyNetAktBurned, BmeSnapshots.dailyNetAktBurned, "AKT", "Daily net AKT burned", "AKT burned for ACT minus AKT reminted, per day."],
    [BmeSnapshotsUrlParam.netAktBurned, BmeSnapshots.netAktBurned, "AKT", "Net AKT burned", "AKT burned for ACT minus AKT reminted, all-time."],
    [BmeSnapshotsUrlParam.dailyAktBurnedForAct, BmeSnapshots.dailyAktBurnedForAct, "AKT", "Daily AKT burned for ACT", "AKT burned to mint ACT, per day."],
    [BmeSnapshotsUrlParam.totalAktBurnedForAct, BmeSnapshots.totalAktBurnedForAct, "AKT", "Total AKT burned for ACT", "AKT burned to mint ACT, all-time."],
    [BmeSnapshotsUrlParam.dailyActMinted, BmeSnapshots.dailyActMinted, "ACT", "Daily ACT minted", "ACT minted from burned AKT, per day."],
    [BmeSnapshotsUrlParam.totalActMinted, BmeSnapshots.totalActMinted, "ACT", "Total ACT minted", "ACT minted from burned AKT, all-time."],
    [BmeSnapshotsUrlParam.dailyActBurnedForAkt, BmeSnapshots.dailyActBurnedForAkt, "ACT", "Daily ACT burned for AKT", "ACT burned to remint AKT, per day."],
    [BmeSnapshotsUrlParam.totalActBurnedForAkt, BmeSnapshots.totalActBurnedForAkt, "ACT", "Total ACT burned for AKT", "ACT burned to remint AKT, all-time."],
    [BmeSnapshotsUrlParam.dailyAktReminted, BmeSnapshots.dailyAktReminted, "AKT", "Daily AKT reminted", "AKT reminted from burned ACT, per day."],
    [BmeSnapshotsUrlParam.totalAktReminted, BmeSnapshots.totalAktReminted, "AKT", "Total AKT reminted", "AKT reminted from burned ACT, all-time."]
  ];

  return definitions.map(([urlParam, snapshot, unit, title, description]) => ({
    ...bmeGraph(urlParam, snapshot),
    ...(unit === "ratio" ? ratio : tokens(unit)),
    group: "Burn mint equilibrium",
    label: title,
    title,
    description,
    readCurrent: (sources: GraphSources) => {
      const value = fromBme(snapshot)(sources);

      return value === undefined ? undefined : unit === "ratio" ? value : fromMicro(value);
    }
  }));
}

function solanaMigrationMetrics(): GraphMetric[] {
  const definitions: [keyof typeof SinkSnapshots, "AKT" | "count", string, string, string][] = [
    ["mintedUakt", "AKT", "AKT migrated", "AKT migrated to Solana", "AKT escrowed on Akash and minted on Solana, all-time."],
    ["dailyMintedUakt", "AKT", "AKT migrated / day", "AKT migrated to Solana per day", "AKT escrowed on Akash and minted on Solana, per day."],
    ["mintedTransfers", "count", "Transfers", "Transfers to Solana (all-time)", "Migration transfers minted on Solana, all-time."],
    ["dailyMintedTransfers", "count", "Transfers / day", "Transfers to Solana per day", "Migration transfers minted on Solana, per day."],
    ["pendingUakt", "AKT", "AKT pending mint", "AKT pending mint", "AKT deposited for migration and not yet confirmed as minted on Solana."],
    ["voidedUakt", "AKT", "AKT voided", "AKT voided", "AKT in transfers voided by governance and awaiting confirmation on Solana."],
    ["refundPendingUakt", "AKT", "AKT awaiting refund", "AKT awaiting refund", "AKT authorized for a refund on Akash and still in its challenge period."],
    ["refundedUakt", "AKT", "AKT refunded", "AKT refunded", "AKT refunded to its original owner on Akash, all-time."],
    ["uniqueSenders", "count", "Migrating addresses", "Addresses migrating to Solana", "Akash addresses that have started a migration transfer, all-time."]
  ];

  return definitions.map(([key, unit, label, title, description]) => ({
    ...solanaMigrationGraph(key),
    ...(unit === "count" ? count : tokens(unit)),
    group: "Solana migration",
    label,
    title,
    description,
    readCurrent: (sources: GraphSources) => {
      const value = sources.sink?.now?.[key];

      return value === undefined || unit === "count" ? value : fromMicro(value);
    }
  }));
}

export function findGraphMetric(kind: GraphKind, urlParam: string) {
  return GRAPH_METRICS.find(metric => metric.kind === kind && metric.urlParam === urlParam);
}

export function graphMetricHref(metric: Pick<GraphMetric, "kind" | "urlParam">) {
  return `/${metric.kind}/${metric.urlParam}`;
}

export function groupGraphMetrics(metrics: GraphMetric[]) {
  const groups = new Map<string, GraphMetric[]>();

  for (const metric of metrics) {
    groups.set(metric.group, [...(groups.get(metric.group) ?? []), metric]);
  }

  return [...groups].map(([name, groupMetrics]) => ({ name, metrics: groupMetrics }));
}
