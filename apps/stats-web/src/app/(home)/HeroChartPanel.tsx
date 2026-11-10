"use client";
import { useMemo, useState } from "react";

import type { HeroMetricKey } from "./dashboardModel";
import { HERO_METRICS } from "./dashboardModel";

import { Link } from "@/components/Link/Link";
import { LineChart } from "@/components/stats/LineChart";
import { DeltaLabel, Panel } from "@/components/stats/Panel";
import { RangePicker, SegmentedTabs } from "@/components/stats/Toggles";
import type { RangeKey, SeriesPoint } from "@/lib/series/series";
import { daysOf, deltaPercent, sliceRange } from "@/lib/series/series";
import { EMPTY_VALUE } from "@/lib/statsFormat/statsFormat";
import { UrlService } from "@/lib/urlUtils";

const HERO_CHART_MIN_HEIGHT = 280;

export function HeroChartPanel({ seriesByMetric, className }: { seriesByMetric: Record<HeroMetricKey, SeriesPoint[] | undefined>; className?: string }) {
  const [metricKey, setMetricKey] = useState<HeroMetricKey>("dailyUsdSpent");
  const [range, setRange] = useState<RangeKey>("90D");
  const metric = HERO_METRICS.find(candidate => candidate.key === metricKey) ?? HERO_METRICS[0];
  const series = seriesByMetric[metricKey];
  const rangedSeries = useMemo(() => (series ? sliceRange(series, daysOf(range)) : []), [series, range]);
  const latest = series?.[series.length - 1];

  return (
    <Panel className={className}>
      <div className="flex h-full flex-col gap-3.5 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2.5">
            <SegmentedTabs<HeroMetricKey>
              label="Network metric"
              options={HERO_METRICS.map(({ key, label }) => ({ value: key, label }))}
              value={metricKey}
              onChange={setMetricKey}
            />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[40px] font-semibold tabular-nums leading-none tracking-[-0.025em]">
                {latest ? metric.formatValue(latest.value) : EMPTY_VALUE}
              </span>
              {series && <DeltaLabel className="text-[13px]" percent={deltaPercent(series, daysOf(range))} period={range.toLowerCase()} />}
            </div>
            <span className="text-xs leading-snug text-faint">{metric.description}</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={UrlService.graph(metric.urlParam)}
              className="whitespace-nowrap text-xs font-medium text-muted-foreground hover:text-akash hover:no-underline"
            >
              Expand →
            </Link>
            <RangePicker value={range} onChange={setRange} />
          </div>
        </div>

        <div className="flex-1">
          <LineChart
            series={rangedSeries}
            minHeight={HERO_CHART_MIN_HEIGHT}
            formatValue={metric.formatValue}
            formatAxisValue={metric.formatAxisValue}
            latestPointLabel={metric.latestPointLabel}
          />
        </div>
      </div>
    </Panel>
  );
}
