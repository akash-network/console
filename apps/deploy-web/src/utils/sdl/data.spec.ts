import { describe, expect, it } from "vitest";

import { defaultPlacement, defaultService } from "./data";

describe("default factories", () => {
  it("defaultPlacement returns an object with a stable id and a default name", () => {
    const placement = defaultPlacement();
    expect(placement.id).toEqual(expect.any(String));
    expect(placement.id.length).toBeGreaterThan(0);
    expect(placement.name).toBe("dcloud");
  });

  it("defaultService references the provided placementId", () => {
    const placement = defaultPlacement();
    const service = defaultService(placement.id);
    expect(service.placementId).toBe(placement.id);
    expect(service.pricing.denom).toEqual(expect.any(String));
  });

  it("defaultService returns independent copies", () => {
    const placement = defaultPlacement();
    const a = defaultService(placement.id);
    const b = defaultService(placement.id);
    a.title = "modified";
    expect(b.title).not.toBe("modified");
  });
});
