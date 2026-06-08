import { describe, expect, it } from "vitest";

import { SdlBuilderFormValuesSchema, ServiceSchema } from "./sdlBuilder";

describe("ServiceSchema", () => {
  it("validates a minimal valid service", () => {
    const result = ServiceSchema.safeParse({
      title: "web",
      image: "nginx:latest",
      profile: {
        cpu: 0.1,
        ram: 256,
        ramUnit: "Mi",
        storage: [{ size: 512, unit: "Mi" }]
      },
      expose: [{ port: 80, as: 80, global: true }],
      placementId: "placement-1",
      pricing: { amount: 1000, denom: "uakt" },
      count: 1
    });

    expect(result.success).toBe(true);
  });
});

describe("SdlBuilderFormValuesSchema", () => {
  it("rejects a service whose placementId does not exist in placements[]", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          title: "web",
          image: "nginx:latest",
          profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-MISSING",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["services", 0, "placementId"], message: "Service references a placement that does not exist." })
    );
  });

  it("rejects duplicate placement names", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [
        { id: "p-1", name: "dcloud" },
        { id: "p-2", name: "dcloud" }
      ],
      services: [
        {
          title: "web",
          image: "nginx:latest",
          profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-1",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["placements", 1, "name"], message: "Placement name must be unique." }));
  });

  it("rejects duplicate service titles", () => {
    const service = {
      title: "web",
      image: "nginx:latest",
      profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
      expose: [{ port: 80, as: 80, global: true }],
      placementId: "p-1",
      pricing: { amount: 1000, denom: "uakt" },
      count: 1
    };
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [service, { ...service }]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["services", 1, "title"], message: "Service name must be unique." }));
  });
});
