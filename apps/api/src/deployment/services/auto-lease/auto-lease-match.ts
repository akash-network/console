import type { Bid } from "@akashnetwork/http-sdk";
import { differenceInMilliseconds } from "date-fns";

import type { UnmatchedLeaseReason } from "@src/deployment/utils/lease-activity/lease-activity";
import type { LeasePlacement } from "@src/deployment/utils/lease-placement/lease-placement";

/** Everything left once bids are in is seconds of work, so this long without a reachable bidder means none is coming. */
export const MATCH_DEADLINE_MS = 90 * 1000;

/** Bids close about 5 min 20 s after they open, so waiting longer for a first one would only lease an expired bid. */
export const FIRST_BID_CEILING_MS = 5 * 60 * 1000;

/** The chain numbers a deployment's groups from 1 in the order they were created, and a database fallback that cannot count them leaves the bids to say which exist. */
export function requiredGseqsOf(groupCount: number | null, bids: Bid[]): number[] {
  if (groupCount !== null) return Array.from({ length: Math.max(groupCount, 1) }, (_, index) => index + 1);

  const bidGseqs = [...new Set(bids.map(bid => bid.bid.id.gseq))].sort((a, b) => a - b);
  return bidGseqs.length ? bidGseqs : [1];
}

/** A placement takes the first of its bids, in the order the chain lists them, whose provider answered; undefined until every placement has one. */
export function pickFirstReachableBidders(requiredGseqs: number[], openBids: Bid[], isReachable: (provider: string) => boolean): LeasePlacement[] | undefined {
  const picks = requiredGseqs.map(gseq => openBids.find(({ bid }) => bid.id.gseq === gseq && isReachable(bid.id.provider)));
  if (!picks.every((pick): pick is Bid => pick !== undefined)) return undefined;

  return picks.map(({ bid: { id } }) => ({ dseq: id.dseq, gseq: id.gseq, oseq: id.oseq, provider: id.provider }));
}

export function unmatchedReasonOf({ startedAt, firstBidAt, now }: { startedAt: Date; firstBidAt?: Date; now: Date }): UnmatchedLeaseReason | undefined {
  if (!firstBidAt) return differenceInMilliseconds(now, startedAt) >= FIRST_BID_CEILING_MS ? "noBids" : undefined;

  return differenceInMilliseconds(now, firstBidAt) >= MATCH_DEADLINE_MS ? "noReachableProvider" : undefined;
}
