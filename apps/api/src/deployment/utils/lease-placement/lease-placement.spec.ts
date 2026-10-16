import { describe, expect, it } from "vitest";

import { isLeaseOn, isSamePlacementSet, type LeasePlacement } from "./lease-placement";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(isLeaseOn.name, () => {
  it("matches a lease on the same placement with the same provider", () => {
    const placement = createPlacement();

    expect(isLeaseOn({ ...placement }, placement)).toBe(true);
  });

  it.each([
    { differs: "dseq", other: (placement: LeasePlacement) => ({ ...placement, dseq: `${placement.dseq}1` }) },
    { differs: "gseq", other: (placement: LeasePlacement) => ({ ...placement, gseq: placement.gseq + 1 }) },
    { differs: "oseq", other: (placement: LeasePlacement) => ({ ...placement, oseq: placement.oseq + 1 }) },
    { differs: "provider", other: (placement: LeasePlacement) => ({ ...placement, provider: createAkashAddress() }) }
  ])("tells apart a lease whose $differs is another", ({ other }) => {
    const placement = createPlacement();

    expect(isLeaseOn(other(placement), placement)).toBe(false);
  });

  function createPlacement(): LeasePlacement {
    return { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
  }
});

describe(isSamePlacementSet.name, () => {
  it("matches the same placements in any order", () => {
    const [first, second] = [createPlacement({ gseq: 1 }), createPlacement({ gseq: 2 })];

    expect(isSamePlacementSet([first, second], [{ ...second }, { ...first }])).toBe(true);
  });

  it("tells apart a set with a placement on another provider", () => {
    const placement = createPlacement({ gseq: 1 });

    expect(isSamePlacementSet([placement], [{ ...placement, provider: createAkashAddress() }])).toBe(false);
  });

  it("tells apart a set of as many placements sharing only some of them", () => {
    const [first, second] = [createPlacement({ gseq: 1 }), createPlacement({ gseq: 2 })];

    expect(isSamePlacementSet([first, second], [first, createPlacement({ gseq: 2 })])).toBe(false);
  });

  it("tells apart a set holding the same placements and more", () => {
    const [first, second] = [createPlacement({ gseq: 1 }), createPlacement({ gseq: 2 })];

    expect(isSamePlacementSet([first], [first, second])).toBe(false);
    expect(isSamePlacementSet([first, second], [first])).toBe(false);
  });

  function createPlacement({ gseq }: { gseq: number }): LeasePlacement {
    return { dseq: "100", gseq, oseq: 1, provider: createAkashAddress() };
  }
});
