import { describe, expect, it } from "vitest";

import type { CumulativeUnbondingPoint } from "./cumulativeUnbondingModel";
import { CUMULATIVE_SERIES, fitCumulativeLines, toCumulativeUnbondingPoints } from "./cumulativeUnbondingModel";

import type { SinkUnbondingsDay } from "@/types";

const NOW = Date.parse("2026-11-13T15:00:00Z");
const PADDING = { top: 10, right: 10, bottom: 10, left: 10 };

describe("cumulativeUnbondingModel", () => {
  describe("CUMULATIVE_SERIES", () => {
    it("lists the running totals from unstaking to sending", () => {
      expect(CUMULATIVE_SERIES.map(series => series.label)).toEqual(["Started unbonding", "Finished unbonding", "Sent to Solana", "Sent by unstakers"]);
    });
  });

  describe(toCumulativeUnbondingPoints.name, () => {
    it("adds up each series day by day, nets cancellations out of the AKT that started unbonding and only schedules liquidity after today", () => {
      const daily = [
        day({ date: "2026-11-12", unbondStartedUakt: 5_000_000, cancelledUakt: 1_000_000, unbondCompletingUakt: 2_000_000 }),
        day({
          date: "2026-11-13",
          unbondStartedUakt: 3_000_000,
          unbondCompletingUakt: 1_000_000,
          sentToSolanaUakt: 2_500_000,
          sentBySendersWhoUnbondedUakt: 500_000
        }),
        day({ date: "2026-11-14", unbondStartedUakt: 9_000_000, unbondCompletingUakt: 4_000_000, sentToSolanaUakt: 9_000_000 })
      ];

      expect(toCumulativeUnbondingPoints(daily, NOW)).toEqual([
        { date: "2026-11-12", time: Date.parse("2026-11-12T00:00:00Z"), startedAkt: 4, liquidAkt: 2, sentAkt: 0, sentByUnstakersAkt: 0, isUpcoming: false },
        { date: "2026-11-13", time: Date.parse("2026-11-13T00:00:00Z"), startedAkt: 7, liquidAkt: 3, sentAkt: 2.5, sentByUnstakersAkt: 0.5, isUpcoming: false },
        {
          date: "2026-11-14",
          time: Date.parse("2026-11-14T00:00:00Z"),
          startedAkt: null,
          liquidAkt: 7,
          sentAkt: null,
          sentByUnstakersAkt: null,
          isUpcoming: true
        }
      ]);
    });
  });

  describe(fitCumulativeLines.name, () => {
    it("draws the actual totals up to today and the scheduled liquidity from today on", () => {
      const points = [
        point({ date: "2026-11-12", startedAkt: 2, liquidAkt: 1, sentAkt: 1, sentByUnstakersAkt: 0 }),
        point({ date: "2026-11-13", startedAkt: 4, liquidAkt: 2, sentAkt: 2, sentByUnstakersAkt: 1 }),
        point({ date: "2026-11-14", startedAkt: null, liquidAkt: 4, sentAkt: null, sentByUnstakersAkt: null, isUpcoming: true })
      ];

      const fitted = fitCumulativeLines(points, 140, 100, PADDING);

      expect(fitted.ticks).toEqual([0, 1, 2, 3, 4]);
      expect(fitted.baseline).toBe(90);
      expect(fitted.points.map(({ x, slotX, slotWidth }) => ({ x, slotX, slotWidth }))).toEqual([
        { x: 30, slotX: 10, slotWidth: 40 },
        { x: 70, slotX: 50, slotWidth: 40 },
        { x: 110, slotX: 90, slotWidth: 40 }
      ]);
      expect(fitted.paths).toEqual({
        startedAkt: "M30 50L70 10",
        liquidAkt: "M30 70L70 50",
        upcomingLiquidAkt: "M70 50L110 10",
        sentAkt: "M30 70L70 50",
        sentByUnstakersAkt: "M30 90L70 70"
      });
    });

    it("draws only scheduled liquidity when every day is upcoming", () => {
      const fitted = fitCumulativeLines(
        [point({ startedAkt: null, liquidAkt: 2, sentAkt: null, sentByUnstakersAkt: null, isUpcoming: true })],
        50,
        100,
        PADDING
      );

      expect(fitted.paths).toEqual({ startedAkt: "", liquidAkt: "", upcomingLiquidAkt: "M25 10", sentAkt: "", sentByUnstakersAkt: "" });
    });

    it("keeps every line on the baseline when nothing is unstaked yet", () => {
      const fitted = fitCumulativeLines([point({})], 50, 100, PADDING);

      expect(fitted.ticks).toEqual([0]);
      expect(fitted.yOf(0)).toBe(90);
      expect(fitted.paths.startedAkt).toBe("M25 90");
    });

    it("returns no points or paths for an empty series", () => {
      const fitted = fitCumulativeLines([], 50, 100, PADDING);

      expect(fitted.points).toEqual([]);
      expect(fitted.paths.startedAkt).toBe("");
    });
  });

  function day(input: Partial<SinkUnbondingsDay> & { date: string }): SinkUnbondingsDay {
    return { unbondStartedUakt: 0, unbondCompletingUakt: 0, cancelledUakt: 0, sentToSolanaUakt: 0, sentBySendersWhoUnbondedUakt: 0, ...input };
  }

  function point(input: Partial<CumulativeUnbondingPoint>): CumulativeUnbondingPoint {
    const date = input.date ?? "2026-11-13";
    return { date, time: Date.parse(`${date}T00:00:00Z`), startedAkt: 0, liquidAkt: 0, sentAkt: 0, sentByUnstakersAkt: 0, isUpcoming: false, ...input };
  }
});
