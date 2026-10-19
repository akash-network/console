import { describe, expect, it } from "vitest";

import { deploymentRunwayOf, suggestedPresetAmountUsd } from "./presetAmounts";

describe("presetAmounts", () => {
  describe(suggestedPresetAmountUsd.name, () => {
    it("suggests nothing without a deployment to size the amount for", () => {
      expect(suggestedPresetAmountUsd(undefined)).toBeUndefined();
    });

    it("suggests nothing for a deployment that costs nothing", () => {
      expect(suggestedPresetAmountUsd(0)).toBeUndefined();
    });

    it("suggests the smallest preset that runs the deployment for a week", () => {
      expect(suggestedPresetAmountUsd(20)).toBe(500);
    });

    it("suggests a preset that runs the deployment for exactly a week", () => {
      expect(suggestedPresetAmountUsd(100 / 7)).toBe(100);
    });

    it("suggests the largest preset when only it lasts a week", () => {
      expect(suggestedPresetAmountUsd(100)).toBe(1000);
    });

    it("suggests nothing when even the largest preset runs out within a week", () => {
      expect(suggestedPresetAmountUsd(200)).toBeUndefined();
    });
  });

  describe(deploymentRunwayOf.name, () => {
    it("rounds down to whole days", () => {
      expect(deploymentRunwayOf(100, 20.5)).toBe("about 4 days of this deployment");
    });

    it("names a single day in the singular", () => {
      expect(deploymentRunwayOf(100, 100)).toBe("about 1 day of this deployment");
    });

    it("says less than a day when the amount runs out within one", () => {
      expect(deploymentRunwayOf(100, 101)).toBe("less than a day of this deployment");
    });

    it("counts the days up to a year", () => {
      expect(deploymentRunwayOf(364, 1)).toBe("about 364 days of this deployment");
    });

    it("says over a year from a year on", () => {
      expect(deploymentRunwayOf(365, 1)).toBe("over a year of this deployment");
    });
  });
});
