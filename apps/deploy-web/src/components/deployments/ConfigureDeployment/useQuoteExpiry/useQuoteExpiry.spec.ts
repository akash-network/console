import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useQuoteExpiry";
import { useQuoteExpiry } from "./useQuoteExpiry";

import { act, renderHook } from "@testing-library/react";

/** Fixed "now" so the local per-second tick is deterministic. */
const NOW = 1_780_000_000_000;

type ListBidsResult = ReturnType<typeof DEPENDENCIES.useListBids>;
type BidEntry = NonNullable<ListBidsResult["data"]>["data"][number];
type BidState = BidEntry["bid"]["state"];

describe("useQuoteExpiry", () => {
  it("returns null when disabled", () => {
    const { result } = setup({ enabled: false, bids: [{ height: 1000 }], currentHeight: 1010 });
    expect(result.current).toBeNull();
  });

  it("returns null before any bid exists", () => {
    const { result } = setup({ enabled: true, bids: [], currentHeight: 1010 });
    expect(result.current).toBeNull();
  });

  it("returns null before the latest block loads", () => {
    const { result } = setup({ enabled: true, bids: [{ height: 1000 }], currentHeight: null });
    expect(result.current).toBeNull();
  });

  it("counts down from the earliest bid's creation block measured against the current block", () => {
    const { result } = setup({ enabled: true, bids: [{ height: 1000 }], currentHeight: 1010 });
    expect(result.current).toEqual({ secondsLeft: 259, isExpired: false });
  });

  it("anchors on the earliest bid when providers bid at different blocks", () => {
    const { result } = setup({ enabled: true, bids: [{ height: 1010 }, { height: 1000 }, { height: 1005 }], currentHeight: 1010 });
    expect(result.current?.secondsLeft).toBe(259);
  });

  it("derives the countdown from bids, not the dseq which may be a block height rather than a timestamp", () => {
    const { result } = setup({ enabled: true, dseq: "20123456", bids: [{ height: 1000 }], currentHeight: 1010 });
    expect(result.current).toEqual({ secondsLeft: 259, isExpired: false });
  });

  it("is expired once the block window has elapsed", () => {
    const { result } = setup({ enabled: true, bids: [{ height: 1000 }], currentHeight: 1100 });
    expect(result.current).toEqual({ secondsLeft: 0, isExpired: true });
  });

  it("expires as soon as the bids all close, even with time left on the block estimate", () => {
    const { result } = setup({ enabled: true, bids: [{ height: 1000, state: "closed" }], currentHeight: 1010 });
    expect(result.current).toEqual({ secondsLeft: 0, isExpired: true });
  });

  it("keeps counting while at least one bid is still open", () => {
    const { result } = setup({
      enabled: true,
      bids: [
        { height: 1000, state: "open" },
        { height: 1000, state: "closed" }
      ],
      currentHeight: 1010
    });
    expect(result.current).toEqual({ secondsLeft: 259, isExpired: false });
  });

  it("does not flash expired on the render where the deadline first appears", () => {
    const { result, rerender, renders } = setup({ enabled: true, dseq: "d1", bids: [], currentHeight: 1010 });
    expect(result.current).toBeNull();
    rerender({ enabled: true, dseq: "d1", bids: [{ height: 1000 }], currentHeight: 1010 });
    expect(result.current).toEqual({ secondsLeft: 259, isExpired: false });
    expect(renders.some(value => value?.isExpired)).toBe(false);
  });

  it("ticks down once a second between block refetches", () => {
    const { result } = setup({ enabled: true, bids: [{ height: 1000 }], currentHeight: 1010 });
    expect(result.current?.secondsLeft).toBe(259);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current?.secondsLeft).toBe(257);
  });

  it("stays expired after the closed bids drop out of the query", () => {
    const { result, rerender } = setup({ enabled: true, dseq: "d1", bids: [{ height: 1000, state: "closed" }], currentHeight: 1010 });
    expect(result.current).toEqual({ secondsLeft: 0, isExpired: true });
    rerender({ enabled: true, dseq: "d1", bids: [], currentHeight: 1010 });
    expect(result.current).toEqual({ secondsLeft: 0, isExpired: true });
  });

  it("re-anchors when the deployment changes", () => {
    const { result, rerender } = setup({ enabled: true, dseq: "d1", bids: [{ height: 1000 }], currentHeight: 1100 });
    expect(result.current?.isExpired).toBe(true);
    rerender({ enabled: true, dseq: "d2", bids: [{ height: 1090 }], currentHeight: 1100 });
    expect(result.current).toEqual({ secondsLeft: 259, isExpired: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(input: SetupInput) {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const renders: Array<ReturnType<typeof useQuoteExpiry>> = [];
    const rendered = renderHook(
      (props: SetupInput) => {
        const bids = props.bids?.map(bid => mock<BidEntry>({ bid: mock<BidEntry["bid"]>({ created_at: String(bid.height), state: bid.state ?? "open" }) }));
        const bidsData = props.bids === null ? undefined : mock<NonNullable<ListBidsResult["data"]>>({ data: bids });
        const dependencies: typeof DEPENDENCIES = {
          useListBids: () => mock<ListBidsResult>({ data: bidsData }),
          useBlock: () =>
            mock<ReturnType<typeof DEPENDENCIES.useBlock>>({
              data: props.currentHeight === null ? undefined : { block: { header: { height: props.currentHeight } } }
            })
        };
        const value = useQuoteExpiry({ dseq: props.dseq ?? "any-dseq", enabled: props.enabled }, dependencies);
        renders.push(value);
        return value;
      },
      { initialProps: input }
    );
    return { ...rendered, renders };
  }
});

interface SetupInput {
  enabled: boolean;
  dseq?: string | null;
  bids: Array<{ height: number; state?: BidState }> | null;
  currentHeight: number | null;
}
