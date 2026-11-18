import type { UnbondingChartPadding } from "./unbondingMomentumModel";
import { niceTicks } from "./unbondingMomentumModel";

import type { SinkUnbondingsDay } from "@/types";

export type CumulativeUnbondingPoint = {
  date: string;
  time: number;
  startedAkt: number | null;
  liquidAkt: number;
  sentAkt: number | null;
  sentByUnstakersAkt: number | null;
  isUpcoming: boolean;
};

export type CumulativeSeriesKey = "startedAkt" | "liquidAkt" | "sentAkt" | "sentByUnstakersAkt";

export const CUMULATIVE_SERIES: { key: CumulativeSeriesKey; label: string }[] = [
  { key: "startedAkt", label: "Started unbonding" },
  { key: "liquidAkt", label: "Finished unbonding" },
  { key: "sentAkt", label: "Sent to Solana" },
  { key: "sentByUnstakersAkt", label: "Sent by unstakers" }
];

const DAY_MS = 24 * 60 * 60 * 1000;

const toAkt = (uakt: number) => uakt / 1e6;
const dayStartOf = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function toCumulativeUnbondingPoints(daily: SinkUnbondingsDay[], now: number): CumulativeUnbondingPoint[] {
  const todayStart = now - (now % DAY_MS);
  const totals = { started: 0, liquid: 0, sent: 0, sentByUnstakers: 0 };

  return daily.map(day => {
    const time = dayStartOf(day.date);
    const isUpcoming = time > todayStart;
    totals.liquid += toAkt(day.unbondCompletingUakt);

    if (isUpcoming) {
      return { date: day.date, time, startedAkt: null, liquidAkt: totals.liquid, sentAkt: null, sentByUnstakersAkt: null, isUpcoming };
    }

    totals.started += toAkt(day.unbondStartedUakt - day.cancelledUakt);
    totals.sent += toAkt(day.sentToSolanaUakt);
    totals.sentByUnstakers += toAkt(day.sentBySendersWhoUnbondedUakt);

    return {
      date: day.date,
      time,
      startedAkt: totals.started,
      liquidAkt: totals.liquid,
      sentAkt: totals.sent,
      sentByUnstakersAkt: totals.sentByUnstakers,
      isUpcoming
    };
  });
}

export type FittedCumulativePoint = CumulativeUnbondingPoint & { x: number; slotX: number; slotWidth: number };

export function fitCumulativeLines(points: CumulativeUnbondingPoint[], width: number, height: number, padding: UnbondingChartPadding) {
  const innerWidth = width - padding.left - padding.right;
  const baseline = height - padding.bottom;
  const values = points.flatMap(point => CUMULATIVE_SERIES.map(series => point[series.key] ?? 0));
  const ticks = niceTicks(Math.max(0, ...values));
  const max = ticks[ticks.length - 1];
  const yOf = (value: number) => (max > 0 ? baseline - (value / max) * (baseline - padding.top) : baseline);
  const slotWidth = points.length ? innerWidth / points.length : 0;
  const fitted: FittedCumulativePoint[] = points.map((point, index) => {
    const slotX = padding.left + index * slotWidth;
    return { ...point, slotX, slotWidth, x: slotX + slotWidth / 2 };
  });
  const lastActualIndex = fitted.findLastIndex(point => !point.isUpcoming);
  const pathOf = (key: CumulativeSeriesKey, from: number, to: number) =>
    fitted
      .slice(Math.max(0, from), to + 1)
      .filter(point => point[key] !== null)
      .map((point, index) => `${index ? "L" : "M"}${point.x} ${yOf(point[key] as number)}`)
      .join("");

  return {
    points: fitted,
    ticks,
    baseline,
    yOf,
    paths: {
      startedAkt: pathOf("startedAkt", 0, lastActualIndex),
      liquidAkt: pathOf("liquidAkt", 0, lastActualIndex),
      upcomingLiquidAkt: pathOf("liquidAkt", lastActualIndex, fitted.length - 1),
      sentAkt: pathOf("sentAkt", 0, lastActualIndex),
      sentByUnstakersAkt: pathOf("sentByUnstakersAkt", 0, lastActualIndex)
    }
  };
}
