import { describe, expect, it } from "vitest";

import { toMilestoneCards, toMilestoneMarkers, toUnbondingCohortRows } from "./migrationMilestonesModel";

import type { SinkUnbondings, SinkUnbondingsCohort, SinkUnbondingsDay, SinkUnbondingsMilestone } from "@/types";

describe("migrationMilestonesModel", () => {
  describe(toMilestoneCards.name, () => {
    it("shows the AKT unstaked since each milestone with its delegators and USD value", () => {
      const cards = toMilestoneCards(unbondings({}), 0.5);

      expect(cards.slice(0, 3)).toEqual([
        {
          label: "Unstaked since announcement",
          value: "10.08M",
          unit: "AKT",
          detail: "2,054 delegators · $5.04M",
          tooltip: "AKT unstaked from block 29,238,936 on, net of cancelled unbondings"
        },
        {
          label: "Unstaked since vote passed",
          value: "8.89M",
          unit: "AKT",
          detail: "1,812 delegators · $4.44M",
          tooltip: "AKT unstaked from block 29,341,402 on, net of cancelled unbondings"
        },
        {
          label: "Unstaked since upgrade block",
          value: "8.44M",
          unit: "AKT",
          detail: "1,678 delegators · $4.22M",
          tooltip: "AKT unstaked from block 29,399,482 on, net of cancelled unbondings"
        }
      ]);
    });

    it("leaves the USD value out until the AKT price is known", () => {
      const [card] = toMilestoneCards(unbondings({}), 0);

      expect(card.detail).toBe("2,054 delegators");
    });

    it("shows the share of liquid unstaked AKT that its unstakers sent to Solana across all cohorts", () => {
      const cards = toMilestoneCards(unbondings({}), 0.5);

      expect(cards[3]).toEqual({
        label: "Newly liquid AKT migrated",
        value: "7.4%",
        detail: "221.2K of 3.01M AKT",
        tooltip: "Share of the AKT unstaked since October 1 that finished unbonding and was sent to Solana by the address that unstaked it"
      });
    });

    it("counts only AKT sent from liquid unstaked AKT, not everything its unstakers sent", () => {
      const cohorts = [
        cohort({ liquidUakt: 50_000_000, sentUakt: 90_000_000, sentFromLiquidUakt: 50_000_000 }),
        cohort({ firstUnbondedAfter: "announcement", liquidUakt: 150_000_000, sentUakt: 10_000_000, sentFromLiquidUakt: 10_000_000 })
      ];

      const cards = toMilestoneCards(unbondings({ cohorts }), 0.5);

      expect(cards[3]).toMatchObject({ value: "30.0%", detail: "60 of 200 AKT" });
    });

    it("shows no share before any unstaked AKT finishes unbonding", () => {
      const cards = toMilestoneCards(unbondings({ cohorts: [cohort({ sentUakt: 5_000_000 })] }), 0.5);

      expect(cards[3]).toMatchObject({ value: "—", detail: "0 of 0 AKT" });
    });

    it("shows no cards or rows when the API does not report milestones and cohorts yet", () => {
      const { milestones, cohorts, ...legacyResponse } = unbondings({});

      expect([milestones, cohorts].map(list => list?.length)).toEqual([3, 4]);
      expect(toMilestoneCards(legacyResponse, 0.5)).toEqual([]);
      expect(toUnbondingCohortRows(legacyResponse)).toEqual([]);
    });

    it("shows no cards on a network without migration milestones or before the unbondings load", () => {
      expect(toMilestoneCards(unbondings({ milestones: [] }), 0.5)).toEqual([]);
      expect(toMilestoneCards(undefined, 0.5)).toEqual([]);
    });
  });

  describe(toMilestoneMarkers.name, () => {
    it("marks the UTC day of each indexed milestone and of the first transfer to Solana", () => {
      const daily = [day({ date: "2026-11-10" }), day({ date: "2026-11-11", sentToSolanaUakt: 13_000_000 }), day({ date: "2026-11-12", sentToSolanaUakt: 1 })];

      expect(toMilestoneMarkers(unbondings({ daily }))).toEqual([
        { date: "2026-10-26", label: "Announcement" },
        { date: "2026-11-02", label: "Vote passed" },
        { date: "2026-11-06", label: "Upgrade block" },
        { date: "2026-11-11", label: "First transfer" }
      ]);
    });

    it("leaves out milestones whose block is not indexed yet and the first transfer before there is one", () => {
      const milestones = [
        milestone({ key: "announcement", label: "Announcement", date: "2026-10-26T15:02:58.000Z" }),
        milestone({ key: "upgrade", date: null })
      ];

      expect(toMilestoneMarkers(unbondings({ milestones, daily: [day({ date: "2026-11-10" })] }))).toEqual([{ date: "2026-10-26", label: "Announcement" }]);
    });

    it("marks only the first transfer when the API does not report milestones yet", () => {
      const { milestones, ...withoutMilestones } = unbondings({ daily: [day({ date: "2026-11-11", sentToSolanaUakt: 1 })] });

      expect(milestones).toHaveLength(3);
      expect(toMilestoneMarkers(withoutMilestones)).toEqual([{ date: "2026-11-11", label: "First transfer" }]);
    });

    it("returns no markers before the unbondings load", () => {
      expect(toMilestoneMarkers(undefined)).toEqual([]);
    });
  });

  describe(toUnbondingCohortRows.name, () => {
    it("names each cohort after the milestones around its first unstaking and shows the share of its liquid AKT sent to Solana", () => {
      expect(toUnbondingCohortRows(unbondings({}))).toEqual([
        {
          key: "beforeMilestones",
          name: "Before announcement",
          period: "Until Oct 26",
          delegators: "521",
          unbonded: "2.87M",
          liquid: "2.48M",
          senders: "5",
          sent: "22.0K",
          shareSent: "0.9%",
          isLiquid: true
        },
        {
          key: "announcement",
          name: "Announcement → vote passed",
          period: "Oct 26 – Nov 2",
          delegators: "232",
          unbonded: "1.09M",
          liquid: "524.5K",
          senders: "10",
          sent: "209.2K",
          shareSent: "38.1%",
          isLiquid: true
        },
        {
          key: "voteClosed",
          name: "Vote passed → upgrade block",
          period: "Nov 2 – Nov 6",
          delegators: "132",
          unbonded: "435.7K",
          liquid: "Not yet",
          senders: "2",
          sent: "23",
          shareSent: "—",
          isLiquid: false
        },
        {
          key: "upgrade",
          name: "After upgrade block",
          period: "Since Nov 6",
          delegators: "1,658",
          unbonded: "8.10M",
          liquid: "Not yet",
          senders: "9",
          sent: "23.5K",
          shareSent: "—",
          isLiquid: false
        }
      ]);
    });

    it("leaves the period out when the milestones around a cohort are not indexed yet", () => {
      const milestones = [milestone({ key: "announcement", label: "Announcement", date: null })];
      const cohorts = [cohort({ firstUnbondedAfter: null }), cohort({ firstUnbondedAfter: "announcement" })];

      expect(toUnbondingCohortRows(unbondings({ milestones, cohorts })).map(row => [row.name, row.period])).toEqual([
        ["Before announcement", ""],
        ["After announcement", ""]
      ]);
    });

    it("returns no rows on a network without cohorts or before the unbondings load", () => {
      expect(toUnbondingCohortRows(unbondings({ cohorts: [] }))).toEqual([]);
      expect(toUnbondingCohortRows(unbondings({ milestones: [] }))).toEqual([]);
      expect(toUnbondingCohortRows(undefined)).toEqual([]);
    });
  });

  function day(input: Partial<SinkUnbondingsDay> & { date: string }): SinkUnbondingsDay {
    return { unbondStartedUakt: 0, unbondCompletingUakt: 0, cancelledUakt: 0, sentToSolanaUakt: 0, sentBySendersWhoUnbondedUakt: 0, ...input };
  }

  function milestone(input: Partial<SinkUnbondingsMilestone> & Pick<SinkUnbondingsMilestone, "key">): SinkUnbondingsMilestone {
    return { label: "Upgrade block", height: 29399482, date: "2026-11-06T14:20:02.539Z", unbondedSinceUakt: 0, delegatorsSince: 0, ...input };
  }

  function cohort(input: Partial<SinkUnbondingsCohort>): SinkUnbondingsCohort {
    return { firstUnbondedAfter: null, delegators: 0, unbondedUakt: 0, liquidUakt: 0, senders: 0, sentUakt: 0, sentFromLiquidUakt: 0, ...input };
  }

  function unbondings(input: { daily?: SinkUnbondingsDay[]; milestones?: SinkUnbondingsMilestone[]; cohorts?: SinkUnbondingsCohort[] }): SinkUnbondings {
    return {
      summary: { unbondingUakt: 0, unbondingDelegators: 0, senders: 0, sendersWhoUnbonded: 0, sentUakt: 0, sentBySendersWhoUnbondedUakt: 0 },
      daily: input.daily ?? [],
      milestones: input.milestones ?? [
        milestone({
          key: "announcement",
          label: "Announcement",
          height: 29238936,
          date: "2026-10-26T15:02:58.472Z",
          unbondedSinceUakt: 10_079_975_650_159,
          delegatorsSince: 2054
        }),
        milestone({
          key: "voteClosed",
          label: "Vote passed",
          height: 29341402,
          date: "2026-11-02T15:02:58.000Z",
          unbondedSinceUakt: 8_885_315_840_492,
          delegatorsSince: 1812
        }),
        milestone({
          key: "upgrade",
          label: "Upgrade block",
          height: 29399482,
          date: "2026-11-06T14:20:02.539Z",
          unbondedSinceUakt: 8_439_068_331_005,
          delegatorsSince: 1678
        })
      ],
      cohorts: input.cohorts ?? [
        cohort({
          firstUnbondedAfter: null,
          delegators: 521,
          unbondedUakt: 2_874_846_856_201,
          liquidUakt: 2_481_311_788_342,
          senders: 5,
          sentUakt: 21_967_184_417,
          sentFromLiquidUakt: 21_560_300_502
        }),
        cohort({
          firstUnbondedAfter: "announcement",
          delegators: 232,
          unbondedUakt: 1_091_199_538_968,
          liquidUakt: 524_479_640_620,
          senders: 10,
          sentUakt: 209_184_784_105,
          sentFromLiquidUakt: 199_645_289_274
        }),
        cohort({ firstUnbondedAfter: "voteClosed", delegators: 132, unbondedUakt: 435_672_441_485, senders: 2, sentUakt: 23_000_000 }),
        cohort({ firstUnbondedAfter: "upgrade", delegators: 1658, unbondedUakt: 8_097_984_533_460, senders: 9, sentUakt: 23_521_508_276 })
      ]
    };
  }
});
