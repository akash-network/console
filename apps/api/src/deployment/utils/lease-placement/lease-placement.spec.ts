import { describe, expect, it } from "vitest";

import { isLeaseOn, type LeasePlacement } from "./lease-placement";

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
