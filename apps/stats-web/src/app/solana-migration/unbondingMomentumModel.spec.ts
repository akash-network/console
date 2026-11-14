import { describe, expect, it } from "vitest";

import type { UnbondingBar } from "./unbondingMomentumModel";
import { fitUnbondingBars, niceTicks, slotIndexAt, toUnbondingBars, toUnbondingCards, UNBONDING_VIEWS } from "./unbondingMomentumModel";

import type { SinkUnbondings, SinkUnbondingsDay, SinkUnbondingsSummary } from "@/types";

const NOW = Date.parse("2026-11-13T15:00:00Z");
const PADDING = { top: 10, right: 10, bottom: 10, left: 10 };

describe("unbondingMomentumModel", () => {
  describe("UNBONDING_VIEWS", () => {
    it("shows when unstaked AKT becomes liquid first, then when it was unstaked", () => {
      expect(UNBONDING_VIEWS.map(view => [view.value, view.label, view.seriesLabel])).toEqual([
        ["liquid", "Becomes liquid", "Unbonding completes"],
        ["unstaked", "Unstaked", "Unbonding started"]
      ]);
    });
  });

  describe(toUnbondingBars.name, () => {
    it("charts the AKT whose unbonding completes each day, including upcoming days, against the AKT sent to Solana", () => {
      const daily = [
        day({ date: "2026-10-22", unbondStartedUakt: 3_000_000 }),
        day({ date: "2026-11-12", unbondCompletingUakt: 3_000_000, sentToSolanaUakt: 2_000_000, sentBySendersWhoUnbondedUakt: 500_000 }),
        day({ date: "2026-11-13", unbondCompletingUakt: 1_000_000 }),
        day({ date: "2026-11-14", unbondCompletingUakt: 4_500_000 })
      ];

      expect(toUnbondingBars(daily, "liquid", NOW)).toEqual([
        { date: "2026-11-12", time: Date.parse("2026-11-12T00:00:00Z"), unbondingAkt: 3, sentAkt: 2, sentByUnstakersAkt: 0.5, isUpcoming: false },
        { date: "2026-11-13", time: Date.parse("2026-11-13T00:00:00Z"), unbondingAkt: 1, sentAkt: 0, sentByUnstakersAkt: 0, isUpcoming: false },
        { date: "2026-11-14", time: Date.parse("2026-11-14T00:00:00Z"), unbondingAkt: 4.5, sentAkt: 0, sentByUnstakersAkt: 0, isUpcoming: true }
      ]);
    });

    it("leaves out the completions of the first 21 days, whose unbondings started before the first indexed one", () => {
      const daily = [
        day({ date: "2026-10-01" }),
        day({ date: "2026-10-21", unbondCompletingUakt: 1_000_000 }),
        day({ date: "2026-10-22", unbondCompletingUakt: 2_000_000 })
      ];

      expect(toUnbondingBars(daily, "liquid", NOW).map(bar => bar.date)).toEqual(["2026-10-22"]);
    });

    it("returns no bars before anything is indexed", () => {
      expect(toUnbondingBars([], "liquid", NOW)).toEqual([]);
      expect(toUnbondingBars([], "unstaked", NOW)).toEqual([]);
    });

    it("charts the AKT unstaked each day up to today", () => {
      const daily = [
        day({ date: "2026-11-12", unbondStartedUakt: 7_000_000, unbondCompletingUakt: 1_000_000 }),
        day({ date: "2026-11-13", unbondStartedUakt: 2_000_000 }),
        day({ date: "2026-11-14", unbondCompletingUakt: 4_500_000 })
      ];

      expect(toUnbondingBars(daily, "unstaked", NOW).map(bar => [bar.date, bar.unbondingAkt, bar.isUpcoming])).toEqual([
        ["2026-11-12", 7, false],
        ["2026-11-13", 2, false]
      ]);
    });
  });

  describe(toUnbondingCards.name, () => {
    it("shows the AKT unbonding, the AKT becoming liquid this week and how much of the migration comes from unstakers", () => {
      const cards = toUnbondingCards(
        unbondings({
          daily: [
            day({ date: "2026-11-13", unbondCompletingUakt: 900_000_000_000 }),
            day({ date: "2026-11-14", unbondCompletingUakt: 100_000_000_000 }),
            day({ date: "2026-11-20", unbondCompletingUakt: 50_000_000_000 }),
            day({ date: "2026-11-21", unbondCompletingUakt: 700_000_000_000 })
          ]
        }),
        2,
        NOW
      );

      expect(cards).toEqual([
        {
          label: "AKT unbonding",
          value: "3.50M",
          unit: "AKT",
          detail: "120 delegators",
          tooltip: "AKT unstaked and still in its 21-day unbonding period, net of cancelled unbondings"
        },
        {
          label: "Becomes liquid · next 7d",
          value: "150.0K",
          unit: "AKT",
          detail: "$300.0K",
          tooltip: "Unstaked AKT whose unbonding period ends in the next 7 days, after which it can be sent to Solana"
        },
        {
          label: "Migrating addresses that unstaked",
          value: "4",
          detail: "30.8% of 13 migrating addresses",
          tooltip: "Akash addresses that sent AKT to Solana and also unstaked AKT since October 1"
        },
        {
          label: "AKT migrated by unstakers",
          value: "250.0K",
          unit: "AKT",
          detail: "25.0% of AKT sent to Solana",
          tooltip: "AKT sent to Solana by addresses that also unstaked AKT since October 1, excluding voided and refunded transfers"
        }
      ]);
    });

    it("names a single delegator in the singular", () => {
      const [unbonding] = toUnbondingCards(unbondings({ summary: { unbondingDelegators: 1 } }), 2, NOW);

      expect(unbonding.detail).toBe("1 delegator");
    });

    it("leaves the USD value out while the AKT price is unknown", () => {
      const [, becomesLiquid] = toUnbondingCards(unbondings({ daily: [day({ date: "2026-11-14", unbondCompletingUakt: 1_000_000 })] }), 0, NOW);

      expect(becomesLiquid.detail).toBeUndefined();
    });

    it("shows dashes for the shares while nothing is sent to Solana yet", () => {
      const [, , addresses, amount] = toUnbondingCards(
        unbondings({ summary: { senders: 0, sendersWhoUnbonded: 0, sentUakt: 0, sentBySendersWhoUnbondedUakt: 0 } }),
        2,
        NOW
      );

      expect(addresses.detail).toBe("— of 0 migrating addresses");
      expect(amount.detail).toBe("— of AKT sent to Solana");
    });

    it("shows placeholders before the unbondings load", () => {
      const cards = toUnbondingCards(undefined, 2, NOW);

      expect(cards.map(({ value, detail }) => ({ value, detail }))).toEqual(Array(4).fill({ value: "—", detail: undefined }));
    });
  });

  describe(fitUnbondingBars.name, () => {
    it("places each day's unbonding and sent bars side by side and scales them to the largest amount", () => {
      const fitted = fitUnbondingBars(
        [bar({ unbondingAkt: 100, sentAkt: 50, sentByUnstakersAkt: 25 }), bar({ unbondingAkt: 0, sentAkt: 20 })],
        120,
        110,
        PADDING
      );

      expect(fitted.max).toBe(100);
      expect(fitted.ticks).toEqual([0, 25, 50, 75, 100]);
      expect(fitted.baseline).toBe(100);
      expect(
        fitted.bars.map(({ slotX, slotWidth, unbondingX, sentX, barWidth, unbondingY, sentY }) => ({
          slotX,
          slotWidth,
          unbondingX,
          sentX,
          barWidth,
          unbondingY,
          sentY
        }))
      ).toEqual([
        { slotX: 10, slotWidth: 50, unbondingX: 17.5, sentX: 36, barWidth: 16.5, unbondingY: 10, sentY: 55 },
        { slotX: 60, slotWidth: 50, unbondingX: 67.5, sentX: 86, barWidth: 16.5, unbondingY: 100, sentY: 82 }
      ]);
    });

    it("keeps every bar on the baseline when every amount is zero", () => {
      const fitted = fitUnbondingBars([bar({})], 120, 110, PADDING);

      expect(fitted.max).toBe(0);
      expect([fitted.bars[0].unbondingY, fitted.bars[0].sentY, fitted.yOf(0)]).toEqual([100, 100, 100]);
    });

    it("shrinks the gap between a day's bars so a crowded chart keeps each day inside its own slot", () => {
      const fitted = fitUnbondingBars(
        Array.from({ length: 200 }, () => bar({ unbondingAkt: 1 })),
        120,
        110,
        PADDING
      );
      const [first, second] = fitted.bars;

      expect(first.slotWidth).toBeCloseTo(0.5);
      expect(first.unbondingX).toBeCloseTo(10.075);
      expect(first.barWidth).toBeCloseTo(0.14);
      expect(first.sentX).toBeCloseTo(10.285);
      expect(first.sentX + first.barWidth).toBeLessThan(second.unbondingX);
    });

    it("rounds the scale up to the next round step", () => {
      const fitted = fitUnbondingBars([bar({ unbondingAkt: 1_540_000 })], 120, 110, PADDING);

      expect(fitted.ticks).toEqual([0, 500_000, 1_000_000, 1_500_000, 2_000_000]);
      expect(fitted.max).toBe(2_000_000);
    });

    it("returns no bars for an empty series", () => {
      expect(fitUnbondingBars([], 120, 110, PADDING)).toMatchObject({ bars: [], max: 0, baseline: 100 });
    });
  });

  describe(niceTicks.name, () => {
    it.each([
      [100, [0, 25, 50, 75, 100]],
      [7, [0, 2, 4, 6, 8]],
      [3, [0, 1, 2, 3]],
      [0.9, [0, 0.25, 0.5, 0.75, 1]],
      [1_540_000, [0, 500_000, 1_000_000, 1_500_000, 2_000_000]]
    ])("splits %d into at most four round steps", (max, ticks) => {
      expect(niceTicks(max)).toEqual(ticks);
    });

    it("returns a single zero tick when there is nothing to scale", () => {
      expect(niceTicks(0)).toEqual([0]);
    });
  });

  describe(slotIndexAt.name, () => {
    it("returns the day under the pointer", () => {
      expect(slotIndexAt(65, 120, PADDING, 2)).toBe(1);
      expect(slotIndexAt(59, 120, PADDING, 2)).toBe(0);
    });

    it("clamps a pointer in the padding to the first and last day", () => {
      expect(slotIndexAt(2, 120, PADDING, 2)).toBe(0);
      expect(slotIndexAt(118, 120, PADDING, 2)).toBe(1);
    });
  });

  function day(input: Partial<SinkUnbondingsDay> & { date: string }): SinkUnbondingsDay {
    return { unbondStartedUakt: 0, unbondCompletingUakt: 0, cancelledUakt: 0, sentToSolanaUakt: 0, sentBySendersWhoUnbondedUakt: 0, ...input };
  }

  function bar(input: Partial<UnbondingBar>): UnbondingBar {
    return { date: "2026-11-13", time: Date.parse("2026-11-13T00:00:00Z"), unbondingAkt: 0, sentAkt: 0, sentByUnstakersAkt: 0, isUpcoming: false, ...input };
  }

  function unbondings(input: { summary?: Partial<SinkUnbondingsSummary>; daily?: SinkUnbondingsDay[] }): SinkUnbondings {
    return {
      summary: {
        unbondingUakt: 3_500_000_000_000,
        unbondingDelegators: 120,
        senders: 13,
        sendersWhoUnbonded: 4,
        sentUakt: 1_000_000_000_000,
        sentBySendersWhoUnbondedUakt: 250_000_000_000,
        ...input.summary
      },
      daily: input.daily ?? []
    };
  }
});
