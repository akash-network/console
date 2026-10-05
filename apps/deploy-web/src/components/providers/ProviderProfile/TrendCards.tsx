import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { differenceInMinutes, format } from "date-fns";

import type { UptimeQuality } from "@src/components/providers/providerSummary/providerSummary";
import { formatOptionalUptime, getUptimeQuality } from "@src/components/providers/providerSummary/providerSummary";
import type { ApiProviderDetail } from "@src/types/provider";
import { ProfileCard } from "./ProfileCard";
import type { LeaseTrend } from "./useProviderProfileModel";

const UPTIME_TONE_CLASSES: Record<UptimeQuality, string> = {
  excellent: "text-emerald-600 dark:text-emerald-400",
  healthy: "text-sky-600 dark:text-sky-400",
  variable: "text-amber-600 dark:text-amber-500"
};

const CHECK_PERIOD_MINUTES = 15;

type CheckPeriod = { startsAt: Date; status: "online" | "offline" | "partial" };

export const LeaseTrendCard: FC<{ trend: LeaseTrend | null }> = ({ trend }) => {
  const change = trend?.changeOver30Days ?? null;

  return (
    <ProfileCard
      title="Active leases"
      aside={
        change !== null && (
          <span
            className={cn(
              "rounded-full px-[7px] py-0.5 font-mono text-[10.5px] font-semibold",
              change >= 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-500"
            )}
          >
            {change >= 0 ? "▲" : "▼"} {Math.abs(change)} in 30d
          </span>
        )
      }
    >
      <div className="px-3.5 pb-3 pt-3">
        {!trend && <p className="text-xs text-muted-foreground">No lease history yet.</p>}
        {trend && (
          <>
            <div className="mb-2.5 flex items-baseline gap-2">
              <span className="text-[22px] font-semibold leading-none text-foreground">{trend.current}</span>
              <span className="text-[11px] text-muted-foreground">leases running · {trend.series.length} days</span>
            </div>
            <AreaChart series={trend.series} className={change !== null && change < 0 ? "text-amber-500" : "text-emerald-500"} />
            <ChartAxis start={`${trend.series.length}d ago`} end="today" />
          </>
        )}
      </div>
    </ProfileCard>
  );
};

type UptimeProvider = {
  uptime30d: number | null;
  uptime7d: number | null;
  uptime1d: number | null;
  uptime: ApiProviderDetail["uptime"];
};

export const UptimeCard: FC<{ provider: UptimeProvider }> = ({ provider }) => {
  const periods = groupChecks(provider.uptime ?? []);

  return (
    <ProfileCard title="Uptime">
      <div className="px-3.5 pb-3 pt-3">
        <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className={cn(
              "text-[22px] font-semibold leading-none",
              provider.uptime30d === null ? "text-foreground" : UPTIME_TONE_CLASSES[getUptimeQuality(provider.uptime30d)]
            )}
          >
            {formatOptionalUptime(provider.uptime30d)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            30 days · 7d {formatOptionalUptime(provider.uptime7d)} · 24h {formatOptionalUptime(provider.uptime1d)}
          </span>
        </div>
        {periods.length === 0 && <p className="text-xs text-muted-foreground">No checks in the last 24 hours.</p>}
        {periods.length > 0 && (
          <>
            <ol className="flex h-[34px] items-end gap-[2px]" aria-label="Checks over the last 24 hours">
              {periods.map(period => (
                <li
                  key={period.startsAt.toISOString()}
                  title={`${format(period.startsAt, "MMM d, HH:mm")} · ${period.status}`}
                  aria-label={`${format(period.startsAt, "HH:mm")} ${period.status}`}
                  className={cn(
                    "flex-1 rounded-[1px]",
                    period.status === "online" && "h-full bg-emerald-500/85",
                    period.status === "partial" && "h-[22px] bg-amber-500",
                    period.status === "offline" && "h-3 bg-red-500"
                  )}
                />
              ))}
            </ol>
            <ChartAxis start="24h ago" end="now" />
          </>
        )}
      </div>
    </ProfileCard>
  );
};

const AreaChart: FC<{ series: number[]; className?: string }> = ({ series, className }) => {
  if (series.length < 2) return <p className="text-xs text-muted-foreground">Not enough history to draw yet.</p>;

  const { line, area } = buildSparkline(series);

  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" className={cn("block h-[92px] w-full", className)} role="img" aria-label="Active leases over time">
      <path d={area} fill="currentColor" fillOpacity={0.13} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
};

const ChartAxis: FC<{ start: string; end: string }> = ({ start, end }) => (
  <div className="mt-[5px] flex justify-between font-mono text-[9.5px] text-muted-foreground">
    <span>{start}</span>
    <span>{end}</span>
  </div>
);

export function buildSparkline(series: number[]): { line: string; area: string } {
  const low = Math.min(...series) * 0.94;
  const high = Math.max(...series) * 1.06 || 1;
  const toPoint = (value: number, index: number) =>
    `${((index / (series.length - 1)) * 100).toFixed(2)},${(32 - ((value - low) / (high - low || 1)) * 30).toFixed(2)}`;
  const line = series.map((value, index) => `${index ? "L" : "M"}${toPoint(value, index)}`).join("");

  return { line, area: `${line}L100,34L0,34Z` };
}

function groupChecks(checks: ApiProviderDetail["uptime"]): CheckPeriod[] {
  const sorted = [...checks].sort((a, b) => new Date(a.checkDate).getTime() - new Date(b.checkDate).getTime());
  const groups: { startsAt: Date; results: boolean[] }[] = [];

  for (const check of sorted) {
    const checkedAt = new Date(check.checkDate);
    const current = groups.at(-1);
    if (current && differenceInMinutes(checkedAt, current.startsAt) < CHECK_PERIOD_MINUTES) {
      current.results.push(check.isOnline);
    } else {
      groups.push({ startsAt: checkedAt, results: [check.isOnline] });
    }
  }

  return groups.map(({ startsAt, results }) => ({
    startsAt,
    status: results.every(Boolean) ? "online" : results.some(Boolean) ? "partial" : "offline"
  }));
}
