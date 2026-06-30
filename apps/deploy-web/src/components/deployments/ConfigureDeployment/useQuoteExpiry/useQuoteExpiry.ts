import { useEffect, useMemo, useRef, useState } from "react";
import { secondsInMinute } from "date-fns/constants";

import { useBlock } from "@src/queries/useBlocksQuery";
import { BID_POLL_INTERVAL, useListBids } from "@src/queries/useListBids";
import { averageBlockTime } from "@src/utils/priceUtils";

/**
 * Bids close ~5 minutes after they open on-chain. The window is anchored on the earliest bid's creation block —
 * not the dseq, whose encoding isn't guaranteed (the API mints it as a wall-clock timestamp in one path and as a
 * block height in another) — so the countdown stays correct however the dseq was minted.
 */
const QUOTE_WINDOW_SECONDS = 5 * secondsInMinute + 20;

/** Refetch cadence for the latest block height that anchors the countdown (matches useRealTimeLeft/useTrialDeploymentTimeRemaining). */
const BLOCK_REFETCH_INTERVAL = 30_000;

export const DEPENDENCIES = { useListBids, useBlock };

/** A `listBids` result entry. */
type BidEntry = NonNullable<ReturnType<typeof useListBids>["data"]>["data"][number];

interface Input {
  /** Deployment sequence used to fetch this deployment's bids; null when no deployment is active. */
  dseq: string | null;
  /** The countdown only runs while quoting; pass false to keep it inert. */
  enabled: boolean;
}

export interface QuoteExpiry {
  secondsLeft: number;
  isExpired: boolean;
}

/**
 * Counts down to bid expiry for the active deployment. Derives the deadline from on-chain block heights — the
 * earliest bid's `created_at` block versus the latest block, converted to seconds via `averageBlockTime` — mirroring
 * the block-based math in `useTrialDeploymentTimeRemaining`/`useRealTimeLeft`. Ticks locally once a second for a
 * smooth countdown and re-anchors whenever a fresh block arrives. Returns null while disabled, or until both the
 * first bid and the latest block are known — there is nothing to count down to yet. The block estimate is only
 * indicative, so the timer also flips to expired the moment the bids actually close (they exist but none are
 * open), even with time left on the estimate. Once shown it stays put — both the anchor and the closed state are
 * latched — so it never disappears or un-expires after the closed bids drop out of `listBids`.
 */
export function useQuoteExpiry({ dseq, enabled }: Input, dependencies: typeof DEPENDENCIES = DEPENDENCIES): QuoteExpiry | null {
  const bidsQuery = dependencies.useListBids(dseq, { enabled, refetchInterval: BID_POLL_INTERVAL });
  const { data: latestBlock } = dependencies.useBlock("latest", { enabled, refetchInterval: BLOCK_REFETCH_INTERVAL });

  const bids = bidsQuery.data?.data;
  const { earliestBidHeight, allBidsClosed } = useLatchedQuoteWindow(dseq, earliestCreatedHeight(bids), hasBidsButNoneOpen(bids));
  const currentHeight = latestBlock?.block?.header?.height;

  const expiresAt = useMemo(
    function computeExpiresAt() {
      if (earliestBidHeight === null || currentHeight == null) return null;
      const secondsElapsed = (Number(currentHeight) - earliestBidHeight) * averageBlockTime;
      return Date.now() + (QUOTE_WINDOW_SECONDS - secondsElapsed) * 1000;
    },
    [earliestBidHeight, currentHeight]
  );

  const [, setTick] = useState(0);

  useEffect(
    function tickUntilExpiry() {
      if (!enabled || expiresAt === null) return;
      const interval = setInterval(function recompute() {
        setTick(previous => previous + 1);
      }, 1000);
      return function stopTicking() {
        clearInterval(interval);
      };
    },
    [enabled, expiresAt]
  );

  if (!enabled || expiresAt === null) return null;
  const secondsLeft = secondsUntil(expiresAt);
  const isExpired = allBidsClosed || secondsLeft <= 0;
  return { secondsLeft: isExpired ? 0 : secondsLeft, isExpired };
}

/**
 * Latches the quote window for the lifetime of a dseq: the earliest bid's block (so the block countdown keeps
 * running after the bids drop out of `listBids`) and whether the bids have all closed (so a marketplace close
 * expires the timer, and stays expired, even once the closed bids are gone). Both are sticky — bids vanish once
 * closed — and reset when the deployment (dseq) changes.
 */
function useLatchedQuoteWindow(dseq: string | null, observedHeight: number | null, bidsClosed: boolean) {
  const ref = useRef<{ dseq: string | null; height: number | null; closed: boolean }>({ dseq, height: observedHeight, closed: bidsClosed });
  if (ref.current.dseq !== dseq) {
    ref.current = { dseq, height: observedHeight, closed: bidsClosed };
  } else {
    if (ref.current.height === null && observedHeight !== null) ref.current.height = observedHeight;
    if (bidsClosed) ref.current.closed = true;
  }
  return { earliestBidHeight: ref.current.height, allBidsClosed: ref.current.closed };
}

/** True when the deployment has bids but none are still open — the marketplace has closed them all. */
function hasBidsButNoneOpen(bids: BidEntry[] | undefined): boolean {
  return !!bids && bids.length > 0 && bids.every(entry => entry.bid.state !== "open");
}

/** The lowest `created_at` block height across the deployment's bids (open or closed), or null when there are none. */
function earliestCreatedHeight(bids: BidEntry[] | undefined): number | null {
  if (!bids || bids.length === 0) return null;
  return bids.reduce(function keepEarliest(earliest, entry) {
    return Math.min(earliest, Number(entry.bid.created_at));
  }, Infinity);
}

/** Whole seconds until `expiresAt`, floored at 0; 0 when there is no deadline. */
function secondsUntil(expiresAt: number | null): number {
  if (expiresAt === null) return 0;
  return Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
}
