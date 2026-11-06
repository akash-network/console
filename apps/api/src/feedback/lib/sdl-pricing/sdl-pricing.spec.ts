import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { DEFAULT_MAX_PRICE, keepsPlacementPricing, keepsPricing, withDefaultPricing } from "./sdl-pricing";

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

describe(keepsPlacementPricing.name, () => {
  it("keeps pricing when every placement keeps its pricing block, whatever else changes", () => {
    const edited = SOURCE.replace("      attributes:\n        host: akash\n", "").replace("count: 1", "count: 3");

    expect(keepsPlacementPricing(SOURCE, edited)).toBe(true);
  });

  it("treats a placement it cannot read as unpriced on both sides", () => {
    const withBrokenPlacement = SOURCE.replace("deployment:", "    broken: 1\ndeployment:");

    expect(keepsPlacementPricing(withBrokenPlacement, withBrokenPlacement.replace("broken: 1", "broken: 2"))).toBe(true);
  });

  it.each([
    [
      "a renamed placement at the same price",
      SOURCE.replace("    akash:\n      attributes", "    dcloud:\n      attributes").replace("    akash:\n      profile", "    dcloud:\n      profile")
    ],
    [
      "a placement nothing deploys to",
      SOURCE.replace("deployment:", "    spare:\n      pricing:\n        web:\n          denom: uact\n          amount: 1000\ndeployment:")
    ],
    ["a new amount", SOURCE.replace("amount: 1000", "amount: 100000")],
    ["a new denom", SOURCE.replace("denom: uact", "denom: uakt")],
    ["pricing removed", SOURCE.replace("      pricing:\n        web:\n          denom: uact\n          amount: 1000\n", "")],
    ["unreadable yaml", "profiles: ["]
  ])("refuses %s", (_, next) => {
    expect(keepsPlacementPricing(SOURCE, next)).toBe(false);
  });

  it.each([
    ["does not parse", "profiles: ["],
    ["has no placements", 'version: "2.0"\nprofiles:\n  compute: {}\n']
  ])("vouches for nothing when the source %s", (_, source) => {
    expect(keepsPlacementPricing(source, source)).toBe(false);
  });
});

const TWO_PLACEMENTS = `version: "2.0"
profiles:
  placement:
    us:
      attributes:
        region: us-west
      pricing:
        web:
          denom: uakt
          amount: 999999999
        db:
          denom: usd
          amount: -5
    eu:
      pricing:
        web:
          denom: uact
          amount: 1
deployment:
  web:
    us:
      profile: web
      count: 1
    eu:
      profile: web
      count: 1
  db:
    us:
      profile: db
      count: 1
`;

type SdlWithPlacements = { profiles: { placement: Record<string, { attributes?: unknown }> } };

describe(withDefaultPricing.name, () => {
  it("prices every deployed service of every placement at the default ceiling, whatever the SDL said", () => {
    const priced = pricingOf(withDefaultPricing(TWO_PLACEMENTS));

    expect(priced).toEqual({
      us: { web: { denom: "uact", amount: 100000 }, db: { denom: "uact", amount: 100000 } },
      eu: { web: { denom: "uact", amount: 100000 } }
    });
  });

  it("keeps everything but the pricing", () => {
    const { profiles, ...rest } = load(withDefaultPricing(TWO_PLACEMENTS)) as SdlWithPlacements;
    const { profiles: originalProfiles, ...originalRest } = load(TWO_PLACEMENTS) as SdlWithPlacements;

    expect(rest).toEqual(originalRest);
    expect(profiles.placement.us.attributes).toEqual(originalProfiles.placement.us.attributes);
  });

  it("restates a uakt price as the default uact ceiling", () => {
    expect(pricingOf(withDefaultPricing(SOURCE.replace("denom: uact", "denom: uakt")))).toEqual({ akash: { web: { denom: "uact", amount: 100000 } } });
  });

  it("prices a deployed profile the SDL left unpriced", () => {
    const unpriced = SOURCE.replace("      pricing:\n        web:\n          denom: uact\n          amount: 1000\n", "");

    expect(pricingOf(withDefaultPricing(unpriced))).toEqual({ akash: { web: { denom: "uact", amount: 100000 } } });
  });

  it("prices a placement nothing deploys to at the default ceiling too", () => {
    const withUnusedPlacement = SOURCE.replace(
      "deployment:",
      "    spare:\n      pricing:\n        web:\n          denom: uakt\n          amount: 1\ndeployment:"
    );

    expect(pricingOf(withDefaultPricing(withUnusedPlacement))).toEqual({
      akash: { web: { denom: "uact", amount: 100000 } },
      spare: { web: { denom: "uact", amount: 100000 } }
    });
  });

  it("writes each price on its own rather than as a YAML alias", () => {
    expect(withDefaultPricing(TWO_PLACEMENTS)).not.toMatch(/[&*]ref/);
  });

  it("skips placements and deployments it cannot read as mappings", () => {
    const odd = `profiles:\n  placement:\n    broken: 1\n    akash:\n      pricing: 5\ndeployment:\n  web: 1\n  api:\n    akash:\n      profile: 7\n  db:\n    akash:\n      profile: db\n`;

    expect(pricingOf(withDefaultPricing(odd))).toEqual({ broken: 1, akash: { db: { denom: "uact", amount: 100000 } } });
  });

  it("prices only what is already priced when the SDL deploys nothing", () => {
    const nothingDeployed = SOURCE.replace(/deployment:[\s\S]*/, "deployment: []\n");

    expect(pricingOf(withDefaultPricing(nothingDeployed))).toEqual({ akash: { web: { denom: "uact", amount: 100000 } } });
  });

  it.each([
    ["unreadable yaml", "profiles: ["],
    ["a scalar", "just text"],
    ["a list", "- a\n- b\n"],
    ["no profiles", 'version: "2.0"\n'],
    ["profiles that are not a mapping", "profiles: 3\n"],
    ["no placement", "profiles:\n  compute: {}\n"],
    ["placements that are a list", "profiles:\n  placement:\n    - a\n"]
  ])("hands back %s untouched for validation to refuse", (_, sdl) => {
    expect(withDefaultPricing(sdl)).toBe(sdl);
  });

  it("matches the ceiling deploy-web starts every new service with", () => {
    const deployWebSrc = join(__dirname.split("/apps/api/")[0], "apps/deploy-web/src");
    const deployWebSdlData = readFileSync(join(deployWebSrc, "utils/sdl/data.ts"), "utf8");
    const deployWebDenoms = readFileSync(join(deployWebSrc, "config/denom.config.ts"), "utf8");

    expect(deployWebSdlData).toMatch(new RegExp(`defaultPricing = \\(\\)[^{]*\\(\\{\\s*amount: ${DEFAULT_MAX_PRICE.amount},\\s*denom: UACT_DENOM\\s*\\}\\)`));
    expect(deployWebDenoms).toContain(`UACT_DENOM = "${DEFAULT_MAX_PRICE.denom}"`);
  });

  function pricingOf(sdl: string) {
    const { profiles } = load(sdl) as { profiles: { placement: Record<string, { pricing?: unknown } | number> } };
    return Object.fromEntries(
      Object.entries(profiles.placement).map(([name, placement]) => [name, typeof placement === "object" ? placement.pricing : placement])
    );
  }
});
