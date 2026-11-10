import { formatBytes, formatCompact, formatNumber, formatUsd, formatUsdPrice } from "@/lib/statsFormat/statsFormat";
import type { GpuModelPrice, NetworkCapacity } from "@/types";
import { SnapshotsUrlParam } from "@/types/snapshots";

export const microToUnit = (value: number) => value / 1e6;

export type HeroMetricKey = "dailyUsdSpent" | "activeLeases" | "activeGpus" | "dailyLeases";

export type HeroMetric = {
  key: HeroMetricKey;
  label: string;
  description: string;
  urlParam: SnapshotsUrlParam;
  latestPointLabel: string;
  formatValue: (value: number) => string;
  formatAxisValue: (value: number) => string;
};

export const HERO_METRICS: HeroMetric[] = [
  {
    key: "dailyUsdSpent",
    label: "Daily spend",
    description: "USD paid to providers per day, settled on-chain",
    urlParam: SnapshotsUrlParam.dailyUsdSpent,
    latestPointLabel: "LAST 24H",
    formatValue: value => formatUsd(value),
    formatAxisValue: value => formatUsd(value, { compact: true })
  },
  {
    key: "activeLeases",
    label: "Active leases",
    description: "Workloads running on the network right now",
    urlParam: SnapshotsUrlParam.activeLeases,
    latestPointLabel: "NOW",
    formatValue: formatNumber,
    formatAxisValue: formatCompact
  },
  {
    key: "activeGpus",
    label: "GPUs leased",
    description: "GPUs under active lease across all providers",
    urlParam: SnapshotsUrlParam.graphics,
    latestPointLabel: "NOW",
    formatValue: formatNumber,
    formatAxisValue: formatCompact
  },
  {
    key: "dailyLeases",
    label: "New leases / day",
    description: "Fresh deployments matched with providers each day",
    urlParam: SnapshotsUrlParam.dailyDeploymentCount,
    latestPointLabel: "LAST 24H",
    formatValue: formatNumber,
    formatAxisValue: formatCompact
  }
];

const SCARCE_GPU_SHARE = 0.15;

export type GpuRow = {
  key: string;
  model: string;
  ram: string;
  availability: string;
  availablePercent: number;
  isScarce: boolean;
  minPrice: string;
  averagePrice: string;
  maxPrice: string;
};

export function toGpuRows(models: GpuModelPrice[], limit: number): GpuRow[] {
  return [...models]
    .sort((a, b) => b.availability.total - a.availability.total)
    .slice(0, limit)
    .map(model => {
      const { available, total } = model.availability;
      const share = total ? available / total : 0;

      return {
        key: `${model.vendor}-${model.model}-${model.ram}-${model.interface}`,
        model: model.model,
        ram: model.ram.replace(/Gi$/i, "GB").toUpperCase(),
        availability: `${formatNumber(available)} / ${formatNumber(total)}`,
        availablePercent: Math.round(share * 100),
        isScarce: share < SCARCE_GPU_SHARE,
        minPrice: formatUsdPrice(model.price?.min),
        averagePrice: formatUsdPrice(model.price?.weightedAverage),
        maxPrice: formatUsdPrice(model.price?.max)
      };
    });
}

export type CapacityRow = {
  label: string;
  active: string;
  total: string;
  percent: number;
};

export function toCapacityRows(capacity: NetworkCapacity): CapacityRow[] {
  const row = (label: string, active: number, total: number, format: (value: number) => string): CapacityRow => ({
    label,
    active: format(active),
    total: format(total),
    percent: total ? Math.min(100, (active / total) * 100) : 0
  });

  return [
    row("GPU", capacity.activeGPU, capacity.totalGPU, formatNumber),
    row("CPU", capacity.activeCPU / 1000, capacity.totalCPU / 1000, value => `${formatCompact(value)} vCPU`),
    row("Memory", capacity.activeMemory, capacity.totalMemory, formatBytes),
    row("Storage", capacity.activeStorage, capacity.totalStorage, formatBytes)
  ];
}

export function toGpuSummary(capacity: NetworkCapacity) {
  const utilization = capacity.totalGPU ? Math.round((capacity.activeGPU / capacity.totalGPU) * 100) : 0;

  return `${utilization}% utilized · ${formatNumber(capacity.totalGPU - capacity.activeGPU)} available now`;
}
