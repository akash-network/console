import { describe, expect, it } from "vitest";

import { FIRST_BID_CEILING_MS, MATCH_DEADLINE_MS, pickFirstReachableBidders, requiredGseqsOf, unmatchedReasonOf } from "./auto-lease-match";

import { createBid } from "@test/seeders/bid.seeder";

describe("auto lease match", () => {
  describe(requiredGseqsOf.name, () => {
    it("needs one placement per group the chain created, numbered from 1", () => {
      expect(requiredGseqsOf(3, [])).toEqual([1, 2, 3]);
    });

    it("still needs the first placement when the chain lists no group", () => {
      expect(requiredGseqsOf(0, [])).toEqual([1]);
    });

    it("needs the placements the bids name when the group count is unknown", () => {
      const bids = [bidOn({ gseq: 2, provider: "akash1a" }), bidOn({ gseq: 1, provider: "akash1b" }), bidOn({ gseq: 2, provider: "akash1c" })];

      expect(requiredGseqsOf(null, bids)).toEqual([1, 2]);
    });

    it("needs the first placement when neither the chain nor the bids name any", () => {
      expect(requiredGseqsOf(null, [])).toEqual([1]);
    });
  });

  describe(pickFirstReachableBidders.name, () => {
    it("leases each placement's first bidder that answered, in the order the chain lists them", () => {
      const bids = [
        bidOn({ gseq: 1, provider: "akash1silent" }),
        bidOn({ gseq: 1, provider: "akash1first" }),
        bidOn({ gseq: 1, provider: "akash1second" }),
        bidOn({ gseq: 2, provider: "akash1other" })
      ];

      const leases = pickFirstReachableBidders([1, 2], bids, provider => provider !== "akash1silent");

      expect(leases).toEqual([
        { dseq: "1000", gseq: 1, oseq: 1, provider: "akash1first" },
        { dseq: "1000", gseq: 2, oseq: 1, provider: "akash1other" }
      ]);
    });

    it("waits until every placement has a reachable bidder", () => {
      const bids = [bidOn({ gseq: 1, provider: "akash1first" }), bidOn({ gseq: 2, provider: "akash1silent" })];

      expect(pickFirstReachableBidders([1, 2], bids, provider => provider === "akash1first")).toBeUndefined();
    });

    it("waits while no bid is in", () => {
      expect(pickFirstReachableBidders([1], [], () => true)).toBeUndefined();
    });
  });

  describe(unmatchedReasonOf.name, () => {
    const startedAt = new Date("2026-10-26T10:00:00.000Z");

    it("keeps waiting for a first bid until the ceiling", () => {
      expect(unmatchedReasonOf({ startedAt, now: new Date(startedAt.getTime() + FIRST_BID_CEILING_MS - 1) })).toBeUndefined();
    });

    it("gives up on a deployment nobody bid on once the ceiling passes", () => {
      expect(unmatchedReasonOf({ startedAt, now: new Date(startedAt.getTime() + FIRST_BID_CEILING_MS) })).toBe("noBids");
    });

    it("gives up 90 s after the first bid when no bidder is reachable", () => {
      const firstBidAt = new Date(startedAt.getTime() + 60_000);

      expect(unmatchedReasonOf({ startedAt, firstBidAt, now: new Date(firstBidAt.getTime() + MATCH_DEADLINE_MS) })).toBe("noReachableProvider");
    });

    it("counts the match deadline from the first bid, not from the start", () => {
      const firstBidAt = new Date(startedAt.getTime() + 4 * 60_000);

      expect(unmatchedReasonOf({ startedAt, firstBidAt, now: new Date(firstBidAt.getTime() + MATCH_DEADLINE_MS - 1) })).toBeUndefined();
    });
  });

  function bidOn({ gseq, provider }: { gseq: number; provider: string }) {
    return createBid({ provider, dseq: "1000", gseq, oseq: 1 });
  }
});
