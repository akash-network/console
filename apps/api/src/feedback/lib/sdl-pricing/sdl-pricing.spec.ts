import { describe, expect, it } from "vitest";

import { keepsPricing } from "./sdl-pricing";

const SOURCE = `version: "2.0"
profiles:
  placement:
    akash:
      attributes:
        host: akash
      pricing:
        web:
          denom: uact
          amount: 1000
`;

describe(keepsPricing.name, () => {
  it("keeps pricing when the placement loses its attributes or is renamed", () => {
    const renamed = SOURCE.replace("    akash:\n      attributes:\n        host: akash\n", "    dcloud:\n");

    expect(keepsPricing(SOURCE, renamed)).toBe(true);
  });

  it.each([
    ["a new amount", SOURCE.replace("amount: 1000", "amount: 999")],
    ["a new denom", SOURCE.replace("denom: uact", "denom: uakt")],
    ["a priced profile more", SOURCE.replace("      pricing:\n", "      pricing:\n        db:\n          denom: uact\n          amount: 1\n")],
    ["no pricing", 'version: "2.0"\n'],
    ["unreadable yaml", "profiles: ["]
  ])("refuses %s", (_, next) => {
    expect(keepsPricing(SOURCE, next)).toBe(false);
  });

  it("vouches for nothing when the source does not parse", () => {
    expect(keepsPricing("profiles: [", SOURCE)).toBe(false);
  });

  it("reads a placement without pricing as unpriced", () => {
    expect(keepsPricing("profiles:\n  placement:\n    akash: null\n", 'version: "2.0"\n')).toBe(true);
  });
});
