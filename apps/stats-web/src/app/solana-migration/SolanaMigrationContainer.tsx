"use client";
import { HeroChartPanel } from "../(home)/HeroChartPanel";
import { StatsCard } from "../(home)/StatsCard";
import { MigrationTransfersPanel } from "./MigrationTransfersPanel";
import type { MigrationCard } from "./solanaMigrationModel";
import { MIGRATION_HERO_METRICS, toMigrationActivityCards, toMigrationStateCards, toMigrationSummaryCards } from "./solanaMigrationModel";

import { LoadError, Panel } from "@/components/stats/Panel";
import { usePricing } from "@/context/PricingProvider";
import { useGraphSeries } from "@/hooks/useGraphSeries";
import { useNow } from "@/hooks/useNow";
import { formatAgo } from "@/lib/statsFormat/statsFormat";
import { cn } from "@/lib/utils";
import { useSinkDashboardData } from "@/queries";

const MIGRATION_REFRESH_INTERVAL_MS = 60_000;
const [MIGRATED_AKT, DAILY_MIGRATED_AKT, TRANSFERS, DAILY_TRANSFERS] = MIGRATION_HERO_METRICS;

export const SolanaMigrationContainer: React.FunctionComponent = () => {
  const now = useNow(MIGRATION_REFRESH_INTERVAL_MS);
  const { data, isError, refetch } = useSinkDashboardData({ refetchInterval: MIGRATION_REFRESH_INTERVAL_MS });
  const { price } = usePricing();
  const seriesByMetric = {
    [MIGRATED_AKT.key]: useGraphSeries(MIGRATED_AKT.key, MIGRATED_AKT.scale),
    [DAILY_MIGRATED_AKT.key]: useGraphSeries(DAILY_MIGRATED_AKT.key, DAILY_MIGRATED_AKT.scale),
    [TRANSFERS.key]: useGraphSeries(TRANSFERS.key, TRANSFERS.scale),
    [DAILY_TRANSFERS.key]: useGraphSeries(DAILY_TRANSFERS.key, DAILY_TRANSFERS.scale)
  };
  const updatedAt = data?.now?.date ? new Date(data.now.date).getTime() : undefined;

  return (
    <div className="flex flex-col gap-4 pt-7">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em]">Solana migration</h1>
        {updatedAt && <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Updated {formatAgo(updatedAt, now)}</span>}
      </div>
      <p className="max-w-[640px] text-[13px] leading-normal text-muted-foreground">
        AKT is moving from Akash to Solana. Each transfer escrows AKT on Akash and mints it on Solana.
      </p>

      <HeroChartPanel metrics={MIGRATION_HERO_METRICS} metricsLabel="Migration metric" seriesByMetric={seriesByMetric} />

      {isError && !data ? (
        <Panel>
          <LoadError subject="the Solana migration totals" onRetry={() => refetch()} />
        </Panel>
      ) : (
        <>
          <MigrationCardGrid cards={toMigrationSummaryCards(data, price)} />
          <h2 className="pt-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Transfers in other states</h2>
          <MigrationCardGrid cards={toMigrationStateCards(data)} />
        </>
      )}

      <h2 className="pt-4 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Individual transfers</h2>
      <div className="grid gap-4 xl:grid-cols-4">
        <MigrationCardGrid className="xl:col-start-4 xl:row-start-1 xl:grid-cols-1 xl:content-start" cards={toMigrationActivityCards(data)} />
        <MigrationTransfersPanel className="xl:col-span-3 xl:row-start-1" now={now} refetchInterval={MIGRATION_REFRESH_INTERVAL_MS} />
      </div>
    </div>
  );
};

function MigrationCardGrid({ cards, className }: { cards: MigrationCard[]; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {cards.map(card => (
        <StatsCard
          key={card.label}
          text={card.label}
          number={
            <>
              {card.value}
              {card.unit && <span className="ml-1 text-sm">{card.unit}</span>}
            </>
          }
          subNumber={<div className="text-sm font-normal text-muted-foreground">{card.detail ?? "\u00a0"}</div>}
          tooltip={card.tooltip}
          graphPath={card.graphPath}
          diffPercent={card.diffPercent}
        />
      ))}
    </div>
  );
}
