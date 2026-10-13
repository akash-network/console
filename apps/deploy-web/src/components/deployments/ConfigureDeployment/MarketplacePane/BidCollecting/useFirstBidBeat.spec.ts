import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlacementOffer } from "@src/queries/usePlacementOffers";
import { FIRST_BID_BEAT_MS, useFirstBidBeat } from "./useFirstBidBeat";

import { act, renderHook } from "@testing-library/react";
import { buildScreenedProvider } from "@tests/seeders/screenedProvider";

describe(useFirstBidBeat.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("names nobody while the placement still waits", () => {
    const { result } = setup({ isWaiting: true, placementId: "p1", offers: [offer("searching")] });

    expect(result.current).toBeNull();
  });

  it("holds the provider whose bid ended the wait for a beat", () => {
    const bidder = offer("submitted");
    const { result, rerender } = setup({ isWaiting: true, placementId: "p1", offers: [offer("searching")] });

    rerender({ isWaiting: false, placementId: "p1", offers: [offer("unavailable"), bidder] });
    expect(result.current).toBe(bidder);

    act(() => vi.advanceTimersByTime(FIRST_BID_BEAT_MS - 1));
    expect(result.current).toBe(bidder);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBeNull();
  });

  it("skips the beat when the wait ends without a bid", () => {
    const { result, rerender } = setup({ isWaiting: true, placementId: "p1", offers: [offer("searching")] });

    rerender({ isWaiting: false, placementId: "p1", offers: [offer("searching")] });

    expect(result.current).toBeNull();
  });

  it("skips the beat when it moves to a placement that already has bids", () => {
    const { result, rerender } = setup({ isWaiting: true, placementId: "p1", offers: [offer("searching")] });

    rerender({ isWaiting: false, placementId: "p2", offers: [offer("submitted")] });

    expect(result.current).toBeNull();
  });

  it("skips the beat when the placement never waited", () => {
    const { result, rerender } = setup({ isWaiting: false, placementId: "p1", offers: [offer("submitted")] });

    rerender({ isWaiting: false, placementId: "p1", offers: [offer("submitted"), offer("submitted")] });

    expect(result.current).toBeNull();
  });

  it("follows the wait to another placement and plays the beat there", () => {
    const bidder = offer("submitted");
    const { result, rerender } = setup({ isWaiting: true, placementId: "p1", offers: [offer("searching")] });
    rerender({ isWaiting: true, placementId: "p2", offers: [offer("searching")] });

    rerender({ isWaiting: false, placementId: "p2", offers: [bidder] });

    expect(result.current).toBe(bidder);
  });

  it("drops the beat when it moves to another placement before the beat ends", () => {
    const { result, rerender } = setup({ isWaiting: true, placementId: "p1", offers: [offer("searching")] });
    rerender({ isWaiting: false, placementId: "p1", offers: [offer("submitted")] });

    rerender({ isWaiting: false, placementId: "p2", offers: [offer("submitted")] });

    expect(result.current).toBeNull();
  });

  function offer(offerState: PlacementOffer["offerState"]): PlacementOffer {
    return { ...buildScreenedProvider(), offerState };
  }

  function setup(input: { isWaiting: boolean; placementId: string; offers: PlacementOffer[] }) {
    vi.useFakeTimers();
    return renderHook((props: Parameters<typeof useFirstBidBeat>[0]) => useFirstBidBeat(props), { initialProps: input });
  }
});
