import { describe, expect, it } from "vitest";

import { hasSeveralRegions, isInPickedRegions, sdlRegionOf, severalRegionPicksOf } from "./placementRegions";

describe("placementRegions", () => {
  describe(sdlRegionOf.name, () => {
    it("returns the region when exactly one is picked", () => {
      expect(sdlRegionOf(["eu-west"])).toBe("eu-west");
    });

    it("returns nothing when no region is picked", () => {
      expect(sdlRegionOf(undefined)).toBeUndefined();
      expect(sdlRegionOf([])).toBeUndefined();
    });

    it("returns nothing when several regions are picked", () => {
      expect(sdlRegionOf(["eu-west", "na-us-west"])).toBeUndefined();
    });
  });

  describe(hasSeveralRegions.name, () => {
    it("is true only for two or more regions", () => {
      expect(hasSeveralRegions(undefined)).toBe(false);
      expect(hasSeveralRegions([])).toBe(false);
      expect(hasSeveralRegions(["eu-west"])).toBe(false);
      expect(hasSeveralRegions(["eu-west", "na-us-west"])).toBe(true);
    });
  });

  describe(isInPickedRegions.name, () => {
    it("accepts any provider when no region is picked", () => {
      expect(isInPickedRegions(undefined, "eu-west")).toBe(true);
      expect(isInPickedRegions([], null)).toBe(true);
    });

    it("accepts any provider when a single region is picked, since the SDL already enforces it", () => {
      expect(isInPickedRegions(["eu-west"], "na-us-west")).toBe(true);
      expect(isInPickedRegions(["eu-west"], null)).toBe(true);
    });

    it("accepts a provider in one of several picked regions, ignoring case", () => {
      expect(isInPickedRegions(["eu-west", "na-us-west"], "na-us-west")).toBe(true);
      expect(isInPickedRegions(["eu-west", "na-us-west"], "EU-West")).toBe(true);
      expect(isInPickedRegions(["EU-West", "na-us-west"], "eu-west")).toBe(true);
    });

    it("refuses a provider outside several picked regions", () => {
      expect(isInPickedRegions(["eu-west", "na-us-west"], "eu-central")).toBe(false);
    });

    it("refuses a provider whose region is unknown when several regions are picked", () => {
      expect(isInPickedRegions(["eu-west", "na-us-west"], null)).toBe(false);
      expect(isInPickedRegions(["eu-west", "na-us-west"], undefined)).toBe(false);
      expect(isInPickedRegions(["eu-west", "na-us-west"], "")).toBe(false);
    });
  });

  describe(severalRegionPicksOf.name, () => {
    it("keeps the picks of placements choosing several regions, by name", () => {
      const picks = severalRegionPicksOf([
        { name: "web", regions: ["eu-west", "na-us-west"] },
        { name: "db", regions: ["eu-west"] },
        { name: "cache", regions: [] },
        { name: "worker" }
      ]);

      expect(picks).toEqual({ web: ["eu-west", "na-us-west"] });
    });
  });
});
