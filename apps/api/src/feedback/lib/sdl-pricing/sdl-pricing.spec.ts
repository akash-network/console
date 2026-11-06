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
deployment:
  web:
    akash:
      profile: web
      count: 1
`;

const DEARER_PLACEMENT_FIRST = `version: "2.0"
profiles:
  placement:
    dear:
      pricing:
        web:
          denom: uact
          amount: 99999
    akash:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dear:
      profile: web
      count: 1
`;

describe(keepsPricing.name, () => {
  it("keeps pricing when the placement loses its attributes or is renamed", () => {
    const renamed = SOURCE.replace("    akash:\n      attributes:\n        host: akash\n", "    dcloud:\n").replace(
      "    akash:\n      profile",
      "    dcloud:\n      profile"
    );

    expect(keepsPricing(SOURCE, renamed)).toBe(true);
  });

  it("ignores pricing of a placement nothing deploys to", () => {
    const withUnusedPlacement = SOURCE.replace(
      "deployment:",
      "    spare:\n      pricing:\n        web:\n          denom: uakt\n          amount: 1\ndeployment:"
    );

    expect(keepsPricing(SOURCE, withUnusedPlacement)).toBe(true);
  });

  it.each([
    ["a new amount", SOURCE.replace("amount: 1000", "amount: 999")],
    ["a new denom", SOURCE.replace("denom: uact", "denom: uakt")],
    ["an amount written as text", SOURCE.replace("amount: 1000", 'amount: "1000"')],
    ["a deployed placement priced higher while another keeps the old price", DEARER_PLACEMENT_FIRST],
    [
      "a second deployed placement with its own price",
      SOURCE.replace("deployment:", "    extra:\n      pricing:\n        web:\n          denom: uact\n          amount: 5000\ndeployment:").replace(
        "      count: 1\n",
        "      count: 1\n    extra:\n      profile: web\n      count: 1\n"
      )
    ],
    [
      "a deployed profile the source never priced",
      SOURCE.replace("      pricing:\n", "      pricing:\n        db:\n          denom: uact\n          amount: 1\n").replace(
        "deployment:\n",
        "deployment:\n  db:\n    akash:\n      profile: db\n      count: 1\n"
      )
    ],
    [
      "the same price under a renamed profile",
      SOURCE.replace("        web:\n          denom", "        app:\n          denom").replace("profile: web", "profile: app")
    ],
    ["pricing removed", SOURCE.replace("      pricing:\n        web:\n          denom: uact\n          amount: 1000\n", "")],
    ["nothing deployed", 'version: "2.0"\n'],
    ["unreadable yaml", "profiles: ["]
  ])("refuses %s", (_, next) => {
    expect(keepsPricing(SOURCE, next)).toBe(false);
  });

  it("vouches for nothing when the source does not parse", () => {
    expect(keepsPricing("profiles: [", SOURCE)).toBe(false);
  });

  it("vouches for nothing when the source deploys an unpriced profile", () => {
    const unpriced = SOURCE.replace("        web:\n          denom", "        db:\n          denom");

    expect(keepsPricing(unpriced, unpriced)).toBe(false);
  });

  it("keeps pricing of an SDL that deploys several priced profiles", () => {
    const twoServices = SOURCE.replace("      pricing:\n", "      pricing:\n        db:\n          denom: uact\n          amount: 50\n").replace(
      "deployment:\n",
      "deployment:\n  db:\n    akash:\n      profile: db\n      count: 1\n"
    );

    expect(keepsPricing(twoServices, twoServices)).toBe(true);
  });
});
