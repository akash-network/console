"use client";
import React, { type FC, type ReactNode, useId } from "react";
import { FormattedNumber } from "react-intl";
import { Card, DateRangePicker, Skeleton, ToggleGroup, ToggleGroupItem } from "@akashnetwork/ui/components";
import { endOfToday, format, getDaysInMonth, startOfDay, subYears } from "date-fns";

import { DailySpendChart } from "@src/components/billing-usage/DailySpendChart/DailySpendChart";
import type { ChildrenProps } from "@src/components/billing-usage/UsageContainer/UsageContainer";
import { countDaysInRange, USAGE_DATE_PRESETS, type UsageDatePreset, type UsageDateRange } from "@src/components/billing-usage/UsageContainer/usageDatePresets";
import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";

export const DEPENDENCIES = {
  DailySpendChart,
  DateRangePicker
};

const CHART_RANGE_OPTIONS = [
  { value: "last7Days", label: "7d" },
  { value: "last30Days", label: "30d" },
  { value: "last90Days", label: "90d" }
] as const satisfies ReadonlyArray<{ value: UsageDatePreset; label: string }>;

/** The usage API rejects windows longer than this. */
const MAX_RANGE_IN_DAYS = 366;

/** A change smaller than this reads as no change rather than a rounded 0%. */
const MIN_REPORTED_CHANGE_PERCENT = 0.5;

const LOAD_ERROR = "Couldn't be loaded. Refresh the page to try again.";

export type UsageViewProps = Omit<ChildrenProps, "onExport"> & {
  dependencies?: typeof DEPENDENCIES;
};

export const UsageView: FC<UsageViewProps> = ({
  usageHistoryData,
  usageHistoryStatsData,
  previousPeriodTotalSpent,
  isUsageHistoryLoading,
  isUsageHistoryError,
  isUsageHistoryStatsLoading,
  isUsageHistoryStatsError,
  spendRate,
  dateRange,
  onDateRangeChange,
  datePreset,
  onDatePresetChange,
  dependencies: d = DEPENDENCIES
}) => {
  const statsError = isUsageHistoryStatsError ? LOAD_ERROR : undefined;
  const totalSpendCaption = [getRangeLabel(datePreset, dateRange), describeChange(usageHistoryStatsData.totalSpent, previousPeriodTotalSpent)]
    .filter(Boolean)
    .join(" · ");
  const daysInRange = countDaysInRange(dateRange);

  return (
    <div className="space-y-6">
      {datePreset === "custom" && (
        <div className="flex sm:justify-end">
          <d.DateRangePicker
            date={dateRange}
            onChange={onDateRangeChange}
            minDate={startOfDay(subYears(new Date(), 1))}
            maxDate={endOfToday()}
            maxRangeInDays={MAX_RANGE_IN_DAYS}
          />
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <StatTile
          label="Total spend"
          isLoading={isUsageHistoryStatsLoading}
          error={statsError}
          value={<UsdValue value={usageHistoryStatsData.totalSpent} />}
          caption={totalSpendCaption}
        />
        <StatTile
          label="Daily average"
          isLoading={isUsageHistoryStatsLoading}
          error={statsError}
          value={<UsdValue value={usageHistoryStatsData.averageSpentPerDay} />}
          caption={`Across ${daysInRange} ${daysInRange === 1 ? "day" : "days"}`}
        />
        <StatTile
          label="Deployments"
          isLoading={isUsageHistoryStatsLoading}
          error={statsError}
          value={<FormattedNumber value={usageHistoryStatsData.totalDeployments} />}
          caption={
            <>
              <FormattedNumber value={usageHistoryStatsData.averageDeploymentsPerDay} maximumFractionDigits={2} /> a day on average
            </>
          }
        />
        <StatTile
          label="Projected month"
          isLoading={spendRate.isLoading}
          error={spendRate.isError ? LOAD_ERROR : undefined}
          value={<UsdValue value={spendRate.perHourUsd * 24 * getDaysInMonth(new Date())} />}
          caption={
            spendRate.perHourUsd > 0 ? (
              <>
                At your current <UsdValue value={spendRate.perHourUsd} />
                /hr
              </>
            ) : (
              "Nothing is running right now"
            )
          }
        />
      </div>

      <d.DailySpendChart
        data={usageHistoryData}
        isLoading={isUsageHistoryLoading}
        isError={isUsageHistoryError}
        rangeToggle={<ChartRangeToggle datePreset={datePreset} onDatePresetChange={onDatePresetChange} />}
      />
    </div>
  );
};

const StatTile: FC<{ label: string; isLoading: boolean; error?: string; value: ReactNode; caption: ReactNode }> = ({
  label,
  isLoading,
  error,
  value,
  caption
}) => {
  const labelId = useId();

  return (
    <Card role="group" aria-labelledby={labelId} aria-busy={isLoading} className="flex min-w-0 flex-col gap-1.5 rounded-xl px-4 py-3.5 shadow-none">
      <span id={labelId} className="font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {isLoading ? (
        <>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-36" />
        </>
      ) : error ? (
        <p className="text-xs text-muted-foreground">{error}</p>
      ) : (
        <>
          <span className="truncate font-mono text-[22px] font-semibold tabular-nums leading-7 tracking-[-0.01em]">{value}</span>
          <span className="text-xs text-muted-foreground">{caption}</span>
        </>
      )}
    </Card>
  );
};

const ChartRangeToggle: FC<{ datePreset: UsageDatePreset; onDatePresetChange: (preset: UsageDatePreset) => void }> = ({ datePreset, onDatePresetChange }) => {
  const selected = CHART_RANGE_OPTIONS.some(option => option.value === datePreset) ? datePreset : "";

  return (
    <ToggleGroup
      type="single"
      value={selected}
      onValueChange={value => value && onDatePresetChange(value as UsageDatePreset)}
      aria-label="Chart range"
      className="gap-0.5 rounded-lg border bg-muted p-[3px]"
    >
      {CHART_RANGE_OPTIONS.map(option => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={getPresetLabel(option.value)}
          className="h-auto rounded-md px-2.5 py-1 text-xs font-normal text-muted-foreground data-[state=on]:bg-background data-[state=on]:font-medium data-[state=on]:text-foreground data-[state=on]:shadow-sm hover:bg-transparent hover:text-foreground"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};

function getPresetLabel(preset: UsageDatePreset) {
  return USAGE_DATE_PRESETS.find(option => option.value === preset)!.label;
}

function getRangeLabel(preset: UsageDatePreset, range: UsageDateRange) {
  if (preset !== "custom") return getPresetLabel(preset);

  const pattern = range.from.getFullYear() === range.to.getFullYear() ? "MMM d" : "MMM d, yyyy";
  return `${format(range.from, pattern)} to ${format(range.to, pattern)}`;
}

function describeChange(total: number, previousTotal: number | null) {
  if (!previousTotal) return null;

  const changePercent = ((total - previousTotal) / previousTotal) * 100;
  if (Math.abs(changePercent) < MIN_REPORTED_CHANGE_PERCENT) return "same as prior";

  return `${changePercent > 0 ? "+" : ""}${Math.round(changePercent)}% vs prior`;
}
