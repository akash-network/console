import { describe, expect, it } from "vitest";

import type { BidWindowInput } from "./bidWindowState";
import { bidWindowState, hasBidsForEveryPlacement } from "./bidWindowState";

const PLACEMENTS = [
  { id: "p1", name: "web" },
  { id: "p2", name: "db" }
];

describe(bidWindowState.name, () => {
  it.each(["configuring", "error", "deploying"] as const)("stays hidden while %s", phase => {
    expect(bidWindowState(input({ phase, isExpired: true }))).toEqual({ kind: "hidden" });
  });

  it("collects bids while the deployment is being created", () => {
    expect(bidWindowState(input({ phase: "creating" }))).toEqual({ kind: "collecting", waitingOn: [] });
  });

  it("collects bids until the first one arrives without naming a placement", () => {
    expect(bidWindowState(input({}))).toEqual({ kind: "collecting", waitingOn: [] });
  });

  it("names the placements still waiting once others have bids", () => {
    expect(bidWindowState(input({ placementsWithBids: new Set(["p1"]) }))).toEqual({ kind: "collecting", waitingOn: ["db"] });
  });

  it("reports the bids collected once every placement has one", () => {
    expect(bidWindowState(input({ placementsWithBids: new Set(["p1", "p2"]) }))).toEqual({ kind: "collected" });
  });

  it("keeps the bids collected once they were, even as open bids drop off", () => {
    expect(bidWindowState(input({ hasCollectedEveryPlacement: true }))).toEqual({ kind: "collected" });
  });

  it("reports the bids expired over every other state", () => {
    expect(bidWindowState(input({ isExpired: true, hasCollectedEveryPlacement: true }))).toEqual({ kind: "expired" });
  });

  it("steps aside once the wait for a first bid ran out with none, which the marketplace explains", () => {
    expect(bidWindowState(input({ noBidsReceived: true }))).toEqual({ kind: "hidden" });
  });

  function input(overrides: Partial<BidWindowInput>): BidWindowInput {
    return {
      phase: "quoting",
      placements: PLACEMENTS,
      placementsWithBids: new Set(),
      hasCollectedEveryPlacement: false,
      isExpired: false,
      noBidsReceived: false,
      ...overrides
    };
  }
});

describe(hasBidsForEveryPlacement.name, () => {
  it.each([
    [["p1", "p2"], true],
    [["p1"], false]
  ])("tells whether bids exist for every placement (%j)", (withBids, expected) => {
    expect(hasBidsForEveryPlacement({ placements: PLACEMENTS, placementsWithBids: new Set(withBids) })).toBe(expected);
  });

  it("never counts a deployment without placements as collected", () => {
    expect(hasBidsForEveryPlacement({ placements: [], placementsWithBids: new Set() })).toBe(false);
  });
});
