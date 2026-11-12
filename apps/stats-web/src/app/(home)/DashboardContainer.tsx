"use client";
import { ChainPanel, LatestBlocksPanel, LatestTransactionsPanel } from "./BlockchainPanels";
import type { HeroMetricKey } from "./dashboardModel";
import { HERO_METRICS, microToUnit } from "./dashboardModel";
import { HeroChartPanel } from "./HeroChartPanel";
import { CapacityPanel, GpuMarketplacePanel, KpiCard } from "./MarketPanels";
import { NetworkNowPanel, SpendPanel } from "./SidePanels";

import { useGraphSeries } from "@/hooks/useGraphSeries";
import { useNow } from "@/hooks/useNow";
import type { SeriesPoint } from "@/lib/series/series";
import { formatAgo, formatCompact, formatNumber } from "@/lib/statsFormat/statsFormat";
import { UrlService } from "@/lib/urlUtils";
import { useDashboardData, useGpuPrices } from "@/queries";
import { Snapshots, SnapshotsUrlParam } from "@/types";

const DASHBOARD_REFRESH_INTERVAL_MS = 30_000;
const HERO_CHART_METRICS = HERO_METRICS.map(metric => ({ ...metric, graphPath: UrlService.graph(metric.urlParam) }));

export const DashboardContainer: React.FunctionComponent = () => {
  const now = useNow(DASHBOARD_REFRESH_INTERVAL_MS);
  const { data: dashboardData } = useDashboardData({ refetchInterval: DASHBOARD_REFRESH_INTERVAL_MS });
  const { data: gpuPrices, isError: isGpuPricesError, refetch: refetchGpuPrices } = useGpuPrices();
  const dailyUsdSpent = useGraphSeries(Snapshots.dailyUUsdSpent, microToUnit);
  const activeLeases = useGraphSeries(Snapshots.activeLeaseCount);
  const activeGpus = useGraphSeries(Snapshots.activeGPU);
  const dailyLeases = useGraphSeries(Snapshots.dailyLeaseCount);
  const totalLeases = useGraphSeries(Snapshots.totalLeaseCount);
  const totalUsdSpent = useGraphSeries(Snapshots.totalUUsdSpent, microToUnit);
  const seriesByMetric: Record<HeroMetricKey, SeriesPoint[] | undefined> = { dailyUsdSpent, activeLeases, activeGpus, dailyLeases };
  const updatedAt = dashboardData?.now?.date ? new Date(dashboardData.now.date).getTime() : undefined;

  return (
    <div className="flex flex-col gap-4 pt-7">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em]">Network overview</h1>
        {updatedAt && <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Updated {formatAgo(updatedAt, now)}</span>}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <HeroChartPanel metrics={HERO_CHART_METRICS} metricsLabel="Network metric" seriesByMetric={seriesByMetric} className="col-span-12 xl:col-span-9" />
        <div className="col-span-12 grid gap-4 md:grid-cols-2 xl:col-span-3 xl:flex xl:flex-col">
          <SpendPanel dashboardData={dashboardData} totalUsdSeries={totalUsdSpent} />
          <NetworkNowPanel dashboardData={dashboardData} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active leases"
          value={formatNumber(lastValueOf(activeLeases))}
          series={activeLeases}
          href={UrlService.graph(SnapshotsUrlParam.activeLeases)}
        />
        <KpiCard label="GPUs leased" value={formatNumber(lastValueOf(activeGpus))} series={activeGpus} href={UrlService.graph(SnapshotsUrlParam.graphics)} />
        <KpiCard
          label="New leases · 24h"
          value={formatNumber(lastValueOf(dailyLeases))}
          series={dailyLeases}
          href={UrlService.graph(SnapshotsUrlParam.dailyDeploymentCount)}
        />
        <KpiCard
          label="Total leases · All-time"
          value={formatCompact(lastValueOf(totalLeases))}
          series={totalLeases}
          href={UrlService.graph(SnapshotsUrlParam.allTimeDeploymentCount)}
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <GpuMarketplacePanel
          models={gpuPrices?.models}
          capacity={dashboardData?.networkCapacity}
          loadError={isGpuPricesError ? { onRetry: () => refetchGpuPrices() } : undefined}
          className="col-span-12 xl:col-span-9"
        />
        <CapacityPanel capacity={dashboardData?.networkCapacity} className="col-span-12 xl:col-span-3" />
      </div>

      <h2 className="pt-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Blockchain</h2>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 grid gap-4 lg:grid-cols-2 xl:col-span-9">
          <LatestBlocksPanel />
          <LatestTransactionsPanel />
        </div>
        <ChainPanel chainStats={dashboardData?.chainStats} className="col-span-12 xl:col-span-3" />
      </div>
    </div>
  );
};

function lastValueOf(series: SeriesPoint[] | undefined) {
  return series?.[series.length - 1]?.value;
}
