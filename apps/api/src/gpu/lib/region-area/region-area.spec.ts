import { describe, expect, it } from "vitest";

import { toRegionArea } from "./region-area";

describe(toRegionArea.name, () => {
  it.each([
    ["na-us-west", "us"],
    ["na-us-northeast", "us"],
    ["na-ca-central", "ca"],
    ["eu-west", "eu"],
    ["eu-central", "eu"],
    ["as-west", "me"],
    ["as-east", "apac"],
    ["as-southeast", "apac"],
    ["oc-aus", "apac"],
    ["sa-brazil", "latam"],
    ["central-america", "latam"],
    ["caribbean", "latam"],
    ["NA-US-WEST", "us"]
  ])("maps %s to %s", (region, area) => {
    expect(toRegionArea(region)).toBe(area);
  });

  it.each([["af-west"], ["mars-north"], [""], [null], [undefined]])("maps %s to no area", region => {
    expect(toRegionArea(region)).toBeNull();
  });
});
