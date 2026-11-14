import type { MigrationCard } from "./solanaMigrationModel";

import { formatCompact, formatNumber, formatPercent, formatUsd } from "@/lib/statsFormat/statsFormat";
import type { SinkUnbondings, SinkUnbondingsDay } from "@/types";

export type UnbondingView = "liquid" | "unstaked";

export const UNBONDING_VIEWS: { value: UnbondingView; label: string; seriesLabel: string }[] = [
  { value: "liquid", label: "Becomes liquid", seriesLabel: "Unbonding completes" },
  { value: "unstaked", label: "Unstaked", seriesLabel: "Unbonding started" }
];

export type UnbondingBar = {
  date: string;
  time: number;
  unbondingAkt: number;
  sentAkt: number;
  sentByUnstakersAkt: number;
  isUpcoming: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_LIQUIDITY_DAYS = 7;
/** Completions before the first indexed unbonding plus this period come from unbondings that were never indexed, so they would read as zero. */
const UNBONDING_PERIOD_DAYS = 21;

const toAkt = (uakt: number) => uakt / 1e6;
const dayStartOf = (date: string) => Date.parse(`${date}T00:00:00Z`);
const todayStartOf = (now: number) => now - (now % DAY_MS);

export function toUnbondingBars(daily: SinkUnbondingsDay[], view: UnbondingView, now: number): UnbondingBar[] {
  const todayStart = todayStartOf(now);
  const firstCompleteDayStart = daily.length ? dayStartOf(daily[0].date) + UNBONDING_PERIOD_DAYS * DAY_MS : 0;
  const days = view === "liquid" ? daily.filter(day => dayStartOf(day.date) >= firstCompleteDayStart) : daily.filter(day => dayStartOf(day.date) <= todayStart);

  return days.map(day => ({
    date: day.date,
    time: dayStartOf(day.date),
    unbondingAkt: toAkt(view === "liquid" ? day.unbondCompletingUakt : day.unbondStartedUakt),
    sentAkt: toAkt(day.sentToSolanaUakt),
    sentByUnstakersAkt: toAkt(day.sentBySendersWhoUnbondedUakt),
    isUpcoming: dayStartOf(day.date) > todayStart
  }));
}

export function toUnbondingCards(data: SinkUnbondings | undefined, aktPrice: number, now: number): MigrationCard[] {
  const summary = data?.summary;
  const usdOf = (akt: number | undefined) => (akt !== undefined && aktPrice > 0 ? formatUsd(akt * aktPrice, { compact: true }) : undefined);
  const shareOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : undefined);
  const upcomingLiquidAkt = data && toAkt(sumUpcomingLiquidity(data.daily, now));
  const unbondingAkt = summary && toAkt(summary.unbondingUakt);
  const sentByUnstakersAkt = summary && toAkt(summary.sentBySendersWhoUnbondedUakt);

  return [
    {
      label: "AKT unbonding",
      value: formatCompact(unbondingAkt),
      unit: "AKT",
      detail: summary && `${formatNumber(summary.unbondingDelegators)} ${summary.unbondingDelegators === 1 ? "delegator" : "delegators"}`,
      tooltip: "AKT unstaked and still in its 21-day unbonding period, net of cancelled unbondings"
    },
    {
      label: `Becomes liquid · next ${UPCOMING_LIQUIDITY_DAYS}d`,
      value: formatCompact(upcomingLiquidAkt),
      unit: "AKT",
      detail: usdOf(upcomingLiquidAkt),
      tooltip: `Unstaked AKT whose unbonding period ends in the next ${UPCOMING_LIQUIDITY_DAYS} days, after which it can be sent to Solana`
    },
    {
      label: "Migrating addresses that unstaked",
      value: formatNumber(summary?.sendersWhoUnbonded),
      detail: summary && `${formatPercent(shareOf(summary.sendersWhoUnbonded, summary.senders))} of ${formatNumber(summary.senders)} migrating addresses`,
      tooltip: "Akash addresses that sent AKT to Solana and also unstaked AKT since October 1"
    },
    {
      label: "AKT migrated by unstakers",
      value: formatCompact(sentByUnstakersAkt),
      unit: "AKT",
      detail: summary && `${formatPercent(shareOf(summary.sentBySendersWhoUnbondedUakt, summary.sentUakt))} of AKT sent to Solana`,
      tooltip: "AKT sent to Solana by addresses that also unstaked AKT since October 1, excluding voided and refunded transfers"
    }
  ];
}

function sumUpcomingLiquidity(daily: SinkUnbondingsDay[], now: number) {
  const todayStart = todayStartOf(now);
  const lastDayStart = todayStart + UPCOMING_LIQUIDITY_DAYS * DAY_MS;

  return daily
    .filter(day => dayStartOf(day.date) > todayStart && dayStartOf(day.date) <= lastDayStart)
    .reduce((total, day) => total + day.unbondCompletingUakt, 0);
}

export type UnbondingChartPadding = { top: number; right: number; bottom: number; left: number };

export type FittedUnbondingBar = UnbondingBar & {
  unbondingX: number;
  sentX: number;
  barWidth: number;
  unbondingY: number;
  sentY: number;
  slotX: number;
  slotWidth: number;
};

/** The gap between a day's two bars shrinks with the slot so a long series never pushes bars into the next day. */
const MAX_BAR_GAP = 2;
const MAX_BAR_GAP_RATIO = 0.2;
const DAY_GAP_RATIO = 0.3;

const MAX_TICK_INTERVALS = 4;
const NICE_STEP_FACTORS = [1, 2, 2.5, 5, 10];

export function niceTicks(max: number) {
  if (max <= 0) return [0];

  const magnitude = 10 ** Math.floor(Math.log10(max / MAX_TICK_INTERVALS));
  const step = NICE_STEP_FACTORS.map(factor => factor * magnitude).find(candidate => candidate * MAX_TICK_INTERVALS >= max) as number;

  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, index) => index * step);
}

export function fitUnbondingBars(bars: UnbondingBar[], width: number, height: number, padding: UnbondingChartPadding) {
  const innerWidth = width - padding.left - padding.right;
  const baseline = height - padding.bottom;
  const ticks = niceTicks(Math.max(0, ...bars.flatMap(bar => [bar.unbondingAkt, bar.sentAkt])));
  const max = ticks[ticks.length - 1];
  const yOf = (value: number) => (max > 0 ? baseline - (value / max) * (baseline - padding.top) : baseline);
  const slotWidth = bars.length ? innerWidth / bars.length : 0;
  const pairWidth = slotWidth * (1 - DAY_GAP_RATIO);
  const barGap = Math.min(MAX_BAR_GAP, pairWidth * MAX_BAR_GAP_RATIO);
  const barWidth = (pairWidth - barGap) / 2;

  const fitted: FittedUnbondingBar[] = bars.map((bar, index) => {
    const slotX = padding.left + index * slotWidth;
    const unbondingX = slotX + (slotWidth * DAY_GAP_RATIO) / 2;

    return {
      ...bar,
      slotX,
      slotWidth,
      unbondingX,
      sentX: unbondingX + barWidth + barGap,
      barWidth,
      unbondingY: yOf(bar.unbondingAkt),
      sentY: yOf(bar.sentAkt)
    };
  });

  return { bars: fitted, max, ticks, baseline, yOf };
}

export function slotIndexAt(x: number, width: number, padding: UnbondingChartPadding, length: number) {
  const innerWidth = width - padding.left - padding.right;
  const index = Math.floor(((x - padding.left) / innerWidth) * length);

  return Math.max(0, Math.min(length - 1, index));
}
