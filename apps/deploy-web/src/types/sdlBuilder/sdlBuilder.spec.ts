import { describe, expect, it } from "vitest";

import { EndpointSchema, SdlBuilderFormValuesSchema, ServiceSchema } from "./sdlBuilder";

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
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["placements", 0, "name"], message: "Placement name must be unique." }));
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
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["services", 0, "title"], message: "Service name must be unique." }));
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["services", 1, "title"], message: "Service name must be unique." }));
  });

  it("accepts a valid endpoints array", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
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
      ],
      endpoints: [{ id: "e-1", name: "endpoint-1" }]
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate endpoint names", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
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
      ],
      endpoints: [
        { id: "e-1", name: "endpoint-1" },
        { id: "e-2", name: "endpoint-1" }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["endpoints", 0, "name"], message: "Endpoint name must be unique." }));
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["endpoints", 1, "name"], message: "Endpoint name must be unique." }));
  });

  it("flags duplicate endpoint names even when a service image is invalid", () => {
    const result = SdlBuilderFormValuesSchema.safeParse({
      placements: [{ id: "p-1", name: "dcloud" }],
      services: [
        {
          title: "web",
          image: "",
          profile: { cpu: 0.1, ram: 256, ramUnit: "Mi", storage: [{ size: 512, unit: "Mi" }] },
          expose: [{ port: 80, as: 80, global: true }],
          placementId: "p-1",
          pricing: { amount: 1000, denom: "uakt" },
          count: 1
        }
      ],
      endpoints: [
        { id: "e-1", name: "endpoint-1" },
        { id: "e-2", name: "endpoint-1" }
      ]
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ["endpoints", 1, "name"], message: "Endpoint name must be unique." }));
  });
});

describe("EndpointSchema", () => {
  it("rejects a name with invalid characters", () => {
    const result = EndpointSchema.safeParse({ id: "e-1", name: "Endpoint_1!" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid lowercase-dashed name", () => {
    const result = EndpointSchema.safeParse({ id: "e-1", name: "endpoint-1" });
    expect(result.success).toBe(true);
  });
});
