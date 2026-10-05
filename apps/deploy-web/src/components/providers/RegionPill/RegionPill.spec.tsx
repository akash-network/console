import { describe, expect, it } from "vitest";

import { formatRegionLabel, getRegionTone, RegionPill } from "./RegionPill";

import { render, screen } from "@testing-library/react";

describe("RegionPill", () => {
  it("shows the region's label", () => {
    render(<RegionPill region="eu-central" />);

    expect(screen.getByText("EU Central")).toBeInTheDocument();
  });

  describe(getRegionTone.name, () => {
    it.each([
      ["na-us-west", "northAmerica"],
      ["northern-america", "northAmerica"],
      ["sa-brazil", "southAmerica"],
      ["eu-central", "europe"],
      ["western-europe", "europe"],
      ["as-southeast", "asia"],
      ["ap-northeast", "asia"],
      ["in-central", "asia"],
      ["south-eastern-asia", "asia"],
      ["af-south", "africa"],
      ["oc-aus", "oceania"],
      ["australia-and-new-zealand", "oceania"],
      ["de-dus", "other"]
    ])("groups %s with %s", (region, tone) => {
      expect(getRegionTone(region)).toBe(tone);
    });

    it("ignores case", () => {
      expect(getRegionTone("EU-West")).toBe("europe");
    });
  });

  describe(formatRegionLabel.name, () => {
    it("upper-cases short codes and capitalizes words", () => {
      expect(formatRegionLabel("na-us-southwest")).toBe("NA US Southwest");
      expect(formatRegionLabel("northern-america")).toBe("Northern America");
    });

    it("drops separators at either end of the region", () => {
      expect(formatRegionLabel("-eu-central_ ")).toBe("EU Central");
    });
  });
});
