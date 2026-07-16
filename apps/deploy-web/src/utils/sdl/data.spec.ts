import { describe, expect, it } from "vitest";

import { UACT_DENOM } from "@src/config/denom.config";
import { defaultPlacement, defaultPricing, defaultService, healSdlBuilderDraft } from "./data";

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

describe(healSdlBuilderDraft.name, () => {
  it("fills default pricing for services missing it and preserves the other fields", () => {
    const draft = {
      placements: [{ id: "p1", name: "dcloud" }],
      services: [{ id: "s1", title: "web", image: "nginx", placementId: "p1" }],
      endpoints: []
    };

    const healed = healSdlBuilderDraft(draft);

    expect(healed.services[0]).toEqual({
      id: "s1",
      title: "web",
      image: "nginx",
      placementId: "p1",
      pricing: defaultPricing()
    });
    expect(healed.placements).toEqual(draft.placements);
  });

  it("leaves services with valid pricing untouched", () => {
    const valid = { id: "s1", title: "web", pricing: { amount: 42, denom: UACT_DENOM } };
    const stale = { id: "s2", title: "api" };

    const healed = healSdlBuilderDraft({ services: [valid, stale] });

    expect(healed.services[0]).toBe(valid);
    expect(healed.services[1].pricing).toEqual(defaultPricing());
  });

  it("replaces malformed pricing", () => {
    const healed = healSdlBuilderDraft({ services: [{ id: "s1", pricing: { amount: "1" } }] });

    expect(healed.services[0].pricing).toEqual(defaultPricing());
  });

  it("returns values unchanged when services is absent or not an array", () => {
    const withoutServices = { placements: [] };
    const corrupted = { services: "corrupt" };

    expect(healSdlBuilderDraft(withoutServices)).toBe(withoutServices);
    expect(healSdlBuilderDraft(corrupted)).toBe(corrupted);
  });

  it("gives healed services independent pricing objects", () => {
    const healed = healSdlBuilderDraft({ services: [{ id: "s1" }, { id: "s2" }] });

    healed.services[0].pricing.amount = 1;

    expect(healed.services[1].pricing.amount).toBe(defaultPricing().amount);
  });
});
