import { describe, expect, it } from "vitest";

import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { getPlacementGseq } from "./placementGseq";

describe(getPlacementGseq.name, () => {
  it("resolves a placement's 1-based group sequence from the SDL", () => {
    const { sdl, placementName } = sdlWithSinglePlacement();
    expect(getPlacementGseq(sdl, placementName)).toBe(1);
  });

  it("returns undefined when the placement is not in the SDL", () => {
    const { sdl } = sdlWithSinglePlacement();
    expect(getPlacementGseq(sdl, "missing-placement")).toBeUndefined();
  });

  it("returns undefined for an empty SDL", () => {
    expect(getPlacementGseq("", "dcloud")).toBeUndefined();
  });

  it("returns undefined when the SDL can't be parsed", () => {
    expect(getPlacementGseq('version: "2.0"\nservices: [', "dcloud")).toBeUndefined();
  });

  function sdlWithSinglePlacement() {
    const values = defaultServiceWithPlacement({ image: "nginx:latest" });
    return { sdl: generateSdl(values), placementName: values.placements[0].name };
  }
});
