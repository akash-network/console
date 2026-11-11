"use client";
import { useMemo, useState } from "react";
import { Parser } from "@json2csv/plainjs";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";

import { ZoomableChart } from "@/components/graph/ZoomableChart";
import { Link } from "@/components/Link/Link";
import { DeltaLabel, Eyebrow, LoadError, Panel } from "@/components/stats/Panel";
import { RangePicker } from "@/components/stats/Toggles";
import type { GraphKind, GraphMetric, GraphSources } from "@/lib/graphMetrics/graphMetrics";
import { findGraphMetric, GRAPH_METRICS, graphMetricHref, groupGraphMetrics } from "@/lib/graphMetrics/graphMetrics";
import type { RangeKey, SeriesPoint } from "@/lib/series/series";
import { daysOf, deltaPercent, sliceRange, summarize, toSeries } from "@/lib/series/series";
import { EMPTY_VALUE, formatLongDate, formatPercent } from "@/lib/statsFormat/statsFormat";
import { cn } from "@/lib/utils";
import { useBmeDashboardData, useDashboardData, useGraphSnapshot, useProviderGraphSnapshot } from "@/queries";

const METRIC_GROUPS = groupGraphMetrics(GRAPH_METRICS);

export function GraphPage({ kind, urlParam }: { kind: GraphKind; urlParam: string }) {
  const metric = findGraphMetric(kind, urlParam) ?? GRAPH_METRICS[0];
  const [range, setRange] = useState<RangeKey>("1Y");
  const { series, isError, refetch } = useMetricSeries(metric);
  const { data: dashboard } = useDashboardData();
  const { data: bme } = useBmeDashboardData();
  const rangedSeries = useMemo(() => (series ? sliceRange(series, daysOf(range)) : []), [series, range]);

  return (
    <div className="grid items-start gap-4 pt-7 lg:grid-cols-[264px_minmax(0,1fr)]">
      <GraphSidebar activeMetric={metric} sources={{ dashboard, bme }} />

      <div className="flex min-w-0 flex-col gap-4">
        <Panel className="flex flex-col gap-4 px-5 py-[22px] sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.025em]">{metric.title}</h1>
              <p className="max-w-[560px] text-[13px] leading-normal text-muted-foreground">{metric.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => downloadCsv(metric, rangedSeries, range)}
                disabled={!rangedSeries.length}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-akash disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
              <RangePicker value={range} onChange={setRange} />
            </div>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <span className="text-[40px] font-semibold tabular-nums leading-none tracking-[-0.025em]">
              {rangedSeries.length ? metric.formatValue(rangedSeries[rangedSeries.length - 1].value) : EMPTY_VALUE}
            </span>
            {rangedSeries.length > 1 && <DeltaLabel className="text-[13px]" percent={deltaPercent(rangedSeries, 0)} period={range.toLowerCase()} />}
          </div>

          {!series && isError ? (
            <LoadError subject={metric.label.toLowerCase()} onRetry={refetch} className="h-[400px]" />
          ) : (
            <ZoomableChart series={series ?? []} rangedSeries={rangedSeries} formatValue={metric.formatValue} formatAxisValue={metric.formatAxisValue} />
          )}
        </Panel>

        <GraphSummary metric={metric} series={rangedSeries} range={range} />
      </div>
    </div>
  );
}

function useMetricSeries(metric: GraphMetric) {
  const isProviderGraph = metric.kind === "provider-graph";
  const graphQuery = useGraphSnapshot(metric.snapshot, { enabled: !isProviderGraph });
  const providerGraphQuery = useProviderGraphSnapshot(metric.snapshot, { enabled: isProviderGraph });
  const { data, isError, refetch } = isProviderGraph ? providerGraphQuery : graphQuery;
  const series = useMemo(() => {
    const points = data ? toSeries(data, metric.scale) : [];

    return points.length ? points : undefined;
  }, [data, metric]);

  return { series, isError, refetch: () => refetch() };
}

function GraphSidebar({ activeMetric, sources }: { activeMetric: GraphMetric; sources: GraphSources }) {
  const router = useRouter();

  return (
    <>
      <label className="flex flex-col gap-2 lg:hidden">
        <Eyebrow>Metric</Eyebrow>
        <select
          value={graphMetricHref(activeMetric)}
          onChange={event => router.push(event.target.value)}
          className="h-10 rounded-md border bg-card px-3 text-sm text-foreground outline-none focus:border-akash"
        >
          {METRIC_GROUPS.map(group => (
            <optgroup key={group.name} label={group.name}>
              {group.metrics.map(metric => (
                <option key={graphMetricHref(metric)} value={graphMetricHref(metric)}>
                  {metric.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <Panel className="sticky top-[92px] hidden max-h-[calc(100vh-116px)] flex-col overflow-y-auto p-2 lg:flex">
        {METRIC_GROUPS.map(group => (
          <div key={group.name} className="flex flex-col">
            <Eyebrow className="px-3 pb-2 pt-3.5 text-[10px]">{group.name}</Eyebrow>
            {group.metrics.map(metric => {
              const isActive = metric === activeMetric;
              const current = metric.readCurrent(sources);

              return (
                <Link
                  key={graphMetricHref(metric)}
                  href={graphMetricHref(metric)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-md px-3 py-[9px] transition-colors hover:bg-muted hover:no-underline",
                    isActive ? "bg-muted text-foreground hover:text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="text-[13px] font-medium leading-tight">{metric.label}</span>
                  <span className="whitespace-nowrap font-mono text-[11px] text-faint">{current === undefined ? "" : metric.formatAxisValue(current)}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </Panel>
    </>
  );
}

function GraphSummary({ metric, series, range }: { metric: GraphMetric; series: SeriesPoint[]; range: RangeKey }) {
  if (!series.length) {
    return null;
  }

  const { low, high, average } = summarize(series);
  const first = series[0];
  const last = series[series.length - 1];
  const change = deltaPercent(series, 0);

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <SummaryCard label={`${range} high`} value={metric.formatAxisValue(high.value)} detail={formatLongDate(high.time)} />
      <SummaryCard label={`${range} low`} value={metric.formatAxisValue(low.value)} detail={formatLongDate(low.time)} />
      <SummaryCard label={`${range} average`} value={metric.formatAxisValue(average)} detail={`${series.length} daily points`} />
      <SummaryCard
        label={`Change · ${range}`}
        value={formatPercent(change, { signed: true })}
        detail={`${metric.formatAxisValue(first.value)} → ${metric.formatAxisValue(last.value)}`}
        isPositive={change !== undefined && change > 0}
      />
    </div>
  );
}

function SummaryCard({ label, value, detail, isPositive }: { label: string; value: string; detail: string; isPositive?: boolean }) {
  return (
    <Panel className="flex flex-col gap-2 px-5 py-4">
      <Eyebrow className="text-[10px]">{label}</Eyebrow>
      <span className={cn("text-xl font-semibold tabular-nums leading-none tracking-[-0.02em]", isPositive && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </span>
      <span className="font-mono text-[10px] uppercase text-faint">{detail}</span>
    </Panel>
  );
}

function downloadCsv(metric: GraphMetric, series: SeriesPoint[], range: RangeKey) {
  const parser = new Parser({
    fields: [
      { label: "Date", value: "date" },
      { label: `Value (${metric.csvUnit})`, value: "value" }
    ]
  });
  const csvContent = parser.parse(series.map(point => ({ date: new Date(point.time).toISOString(), value: point.value })));
  const datePart = new Date().toISOString().substring(0, 10).replaceAll("-", "");
  const link = document.createElement("a");

  link.setAttribute("href", encodeURI(`data:text/csv;charset=utf-8,${csvContent}`));
  link.setAttribute("download", `${metric.snapshot}-${datePart}-${range}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
