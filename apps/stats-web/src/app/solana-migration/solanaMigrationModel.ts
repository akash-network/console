import type { GraphMetric } from "@/lib/graphMetrics/graphMetrics";
import { GRAPH_METRICS, graphMetricHref } from "@/lib/graphMetrics/graphMetrics";
import { percIncrease } from "@/lib/mathHelpers";
import { formatCompact, formatNumber, formatUsd } from "@/lib/statsFormat/statsFormat";
import type { SinkDashboardData, SinkPeriodData } from "@/types";
import { SinkSnapshots, SinkSnapshotsUrlParam } from "@/types/snapshots";

const HERO_SNAPSHOTS: string[] = [SinkSnapshots.mintedUakt, SinkSnapshots.dailyMintedUakt, SinkSnapshots.mintedTransfers, SinkSnapshots.dailyMintedTransfers];
const DAILY_SNAPSHOTS: string[] = [SinkSnapshots.dailyMintedUakt, SinkSnapshots.dailyMintedTransfers];

export type MigrationHeroMetric = Pick<GraphMetric, "label" | "description" | "scale" | "formatValue" | "formatAxisValue"> & {
  key: string;
  graphPath: string;
  latestPointLabel: string;
};

export const MIGRATION_HERO_METRICS: MigrationHeroMetric[] = GRAPH_METRICS.filter(
  metric => metric.kind === "solana-migration-graph" && HERO_SNAPSHOTS.includes(metric.snapshot)
).map(metric => ({
  key: metric.snapshot,
  label: metric.label,
  description: metric.description,
  graphPath: graphMetricHref(metric),
  latestPointLabel: DAILY_SNAPSHOTS.includes(metric.snapshot) ? "LAST 24H" : "NOW",
  scale: metric.scale,
  formatValue: metric.formatValue,
  formatAxisValue: metric.formatAxisValue
}));

export type MigrationCard = {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  tooltip: string;
  graphPath: string;
  diffPercent?: number;
};

type AmountKey = "mintedUakt" | "dailyMintedUakt" | "pendingUakt" | "voidedUakt" | "refundPendingUakt" | "refundedUakt";
type TransfersKey = "mintedTransfers" | "dailyMintedTransfers" | "pendingTransfers" | "voidedTransfers" | "refundPendingTransfers" | "refundedTransfers";

const graphPathOf = (key: keyof typeof SinkSnapshotsUrlParam) => graphMetricHref({ kind: "solana-migration-graph", urlParam: SinkSnapshotsUrlParam[key] });
const toAkt = (uakt: number) => uakt / 1e6;

export function toMigrationSummaryCards(data: SinkDashboardData | undefined, aktPrice: number): MigrationCard[] {
  const diffOf = (key: AmountKey | TransfersKey) => data && percIncrease(data.compare[key], data.now[key]);
  const usdOf = (key: AmountKey) => (data && aktPrice > 0 ? formatUsd(toAkt(data.now[key]) * aktPrice, { compact: true }) : undefined);

  return [
    {
      label: "AKT migrated",
      value: formatCompact(data && toAkt(data.now.mintedUakt)),
      unit: "AKT",
      detail: usdOf("mintedUakt"),
      tooltip: "AKT escrowed on Akash and minted on Solana, all-time",
      graphPath: graphPathOf("mintedUakt"),
      diffPercent: diffOf("mintedUakt")
    },
    {
      label: "AKT migrated · 24h",
      value: formatCompact(data && toAkt(data.now.dailyMintedUakt)),
      unit: "AKT",
      detail: usdOf("dailyMintedUakt"),
      tooltip: "AKT minted on Solana in the last 24 hours",
      graphPath: graphPathOf("dailyMintedUakt"),
      diffPercent: diffOf("dailyMintedUakt")
    },
    {
      label: "Transfers",
      value: formatNumber(data?.now.mintedTransfers),
      tooltip: "Migration transfers minted on Solana, all-time",
      graphPath: graphPathOf("mintedTransfers"),
      diffPercent: diffOf("mintedTransfers")
    },
    {
      label: "Transfers · 24h",
      value: formatNumber(data?.now.dailyMintedTransfers),
      tooltip: "Migration transfers minted on Solana in the last 24 hours",
      graphPath: graphPathOf("dailyMintedTransfers"),
      diffPercent: diffOf("dailyMintedTransfers")
    }
  ];
}

export function toMigrationStateCards(data: SinkDashboardData | undefined): MigrationCard[] {
  const card = (label: string, amountKey: AmountKey, transfersKey: TransfersKey, tooltip: string): MigrationCard => ({
    label,
    value: formatCompact(data && toAkt(data.now[amountKey])),
    unit: "AKT",
    detail: data && formatTransfers(data.now, transfersKey),
    tooltip,
    graphPath: graphPathOf(amountKey)
  });

  return [
    card("Pending mint", "pendingUakt", "pendingTransfers", "AKT deposited for migration and not yet confirmed as minted on Solana"),
    card("Voided", "voidedUakt", "voidedTransfers", "AKT in transfers voided by governance and awaiting confirmation on Solana"),
    card("Awaiting refund", "refundPendingUakt", "refundPendingTransfers", "AKT authorized for a refund on Akash and still in its challenge period"),
    card("Refunded", "refundedUakt", "refundedTransfers", "AKT refunded to its original owner on Akash, all-time")
  ];
}

function formatTransfers(period: SinkPeriodData, key: TransfersKey) {
  return `${formatNumber(period[key])} ${period[key] === 1 ? "transfer" : "transfers"}`;
}
