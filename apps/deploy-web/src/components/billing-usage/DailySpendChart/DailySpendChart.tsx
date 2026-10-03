"use client";
import React, { type FC, type ReactNode, useId } from "react";
import { Card, type ChartConfig, ChartContainer, ChartTooltip, Skeleton } from "@akashnetwork/ui/components";
import { format, isToday, parseISO } from "date-fns";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";

export type DailySpend = { date: string; dailyUsdSpent: number };

export const DEPENDENCIES = {
  Card,
  Skeleton,
  ChartContainer
};

const CHART_CONFIG = { dailyUsdSpent: { label: "Spend" } } satisfies ChartConfig;

/** Above this many bars the gap between them shrinks to a hairline so a year still fits. */
const MAX_DAYS_WITH_WIDE_GAPS = 31;

export type DailySpendChartProps = {
  data: DailySpend[];
  isLoading: boolean;
  isError: boolean;
  rangeToggle?: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const DailySpendChart: FC<DailySpendChartProps> = ({ data, isLoading, isError, rangeToggle, dependencies: d = DEPENDENCIES }) => {
  const gradientId = `daily-spend-${useId().replace(/:/g, "")}`;
  const total = data.reduce((sum, day) => sum + day.dailyUsdSpent, 0);
  const isReady = !isLoading && !isError;
  const hasSpend = isReady && total > 0;

  return (
    <d.Card className="rounded-xl px-5 pb-5 pt-4 shadow-none">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">Daily spend</h2>
          <div className="mt-1 h-6 font-mono text-lg font-semibold tabular-nums">
            {isLoading && <d.Skeleton className="h-6 w-28" />}
            {isReady && <UsdValue value={total} />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Each bar is one day's total across all deployments</p>
        </div>
        {rangeToggle}
      </div>

      {isError && (
        <p className="flex h-[140px] items-center justify-center text-center text-sm text-muted-foreground">
          Daily spend couldn't be loaded. Refresh the page to try again.
        </p>
      )}
      {isLoading && <d.Skeleton className="h-[140px] w-full" />}
      {isReady && !hasSpend && <p className="flex h-[140px] items-center justify-center text-sm text-muted-foreground">No spend in this range</p>}
      {hasSpend && (
        <d.ChartContainer config={CHART_CONFIG} className="aspect-auto h-[140px] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={data.length > MAX_DAYS_WITH_WIDE_GAPS ? 1 : 4}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--foreground))" />
                <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[0, "dataMax"]} />
            <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<DailySpendTooltip />} />
            <Bar dataKey="dailyUsdSpent" fill={`url(#${gradientId})`} radius={2} isAnimationActive={false} />
          </BarChart>
        </d.ChartContainer>
      )}

      {!isError && (
        <div className="mt-2 flex h-4 justify-between font-mono text-[10px] tracking-[0.04em] text-muted-foreground">
          {hasSpend && getTickLabels(data).map(label => <span key={label}>{label}</span>)}
        </div>
      )}
    </d.Card>
  );
};

export const DailySpendTooltip: FC<{ active?: boolean; payload?: Array<{ payload: DailySpend }> }> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const day = payload[0].payload;

  return (
    <div className="rounded-lg bg-foreground px-2.5 py-2 text-xs text-background shadow-lg">
      <div>{format(parseISO(day.date), "MMM d, yyyy")}</div>
      <div className="font-mono font-semibold tabular-nums">
        <UsdValue value={day.dailyUsdSpent} />
      </div>
    </div>
  );
};

function getTickLabels(days: DailySpend[]) {
  const lastIndex = days.length - 1;
  const tickIndexes = [...new Set([0, Math.round(lastIndex / 2), lastIndex])];

  return tickIndexes.map(index => {
    const date = parseISO(days[index].date);
    return index === lastIndex && isToday(date) ? "Today" : format(date, "MMM d");
  });
}
