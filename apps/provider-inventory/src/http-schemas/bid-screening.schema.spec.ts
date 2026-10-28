import { describe, expect, it } from "vitest";

import {
  BidScreeningRequestSchema,
  MAX_PLACEMENT_ATTRIBUTES,
  MAX_REPLICA_COUNT,
  MAX_RESOURCE_UNITS,
  MAX_SIGNED_BY_AUDITORS,
  MAX_STORAGE_VOLUMES
} from "./bid-screening.schema";

describe("BidScreeningRequestSchema", () => {
  it("accepts a request that declares no CPU attributes", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest());

    expect(result.success).toBe(true);
  });

  it.each(["amd64", "arm64"])("accepts %s as a requested CPU architecture", value => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([{ key: "arch", value }]));

    expect(result.success).toBe(true);
  });

  it("rejects an architecture outside the SDL enum", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([{ key: "arch", value: "sparc64" }]));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ message: 'Unsupported CPU architecture "sparc64": expected amd64 or arm64' })
    );
  });

  it("rejects a CPU attribute key other than arch", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([{ key: "vendor", value: "intel" }]));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ message: 'Unsupported CPU attribute "vendor": "arch" is the only one' })
    );
  });

  it("rejects a request asking for two architectures at once", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequest([
        { key: "arch", value: "amd64" },
        { key: "arch", value: "arm64" }
      ])
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ message: 'Duplicate CPU attribute "arch": a resource asks for one architecture' })
    );
  });

  it.each(["allOf", "anyOf"] as const)("accepts %s auditors up to the cap", list => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithRequirements({ signedBy: { [list]: buildAuditors(MAX_SIGNED_BY_AUDITORS) }, attributes: [] })
    );

    expect(result.success).toBe(true);
  });

  it.each(["allOf", "anyOf"] as const)("rejects %s auditors beyond the cap", list => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithRequirements({ signedBy: { [list]: buildAuditors(MAX_SIGNED_BY_AUDITORS + 1) }, attributes: [] })
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["requirements", "signedBy", list] })
    );
  });

  it("accepts placement attributes up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithRequirements({ signedBy: {}, attributes: buildPlacementAttributes(MAX_PLACEMENT_ATTRIBUTES) })
    );

    expect(result.success).toBe(true);
  });

  it("rejects placement attributes beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithRequirements({ signedBy: {}, attributes: buildPlacementAttributes(MAX_PLACEMENT_ATTRIBUTES + 1) })
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["requirements", "attributes"] })
    );
  });

  it("accepts a replica count up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit({ count: MAX_REPLICA_COUNT })]));

    expect(result.success).toBe(true);
  });

  it("rejects a replica count beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit({ count: MAX_REPLICA_COUNT + 1 })]));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["resources", 0, "count"] })
    );
  });

  it("accepts resource units up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits(Array.from({ length: MAX_RESOURCE_UNITS }, () => buildResourceUnit())));

    expect(result.success).toBe(true);
  });

  it("rejects resource units beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits(Array.from({ length: MAX_RESOURCE_UNITS + 1 }, () => buildResourceUnit())));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(expect.objectContaining({ code: "too_big", path: ["resources"] }));
  });

  it("accepts storage volumes up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit({ storage: buildStorageVolumes(MAX_STORAGE_VOLUMES, "1") })]));

    expect(result.success).toBe(true);
  });

  it("rejects storage volumes beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithUnits([buildResourceUnit({ storage: buildStorageVolumes(MAX_STORAGE_VOLUMES + 1, "1") })])
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["resources", 0, "resource", "storage"] })
    );
  });

  it("rejects a resource unit that requests no CPU, memory, GPU or storage", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequestWithUnits([buildResourceUnit({ cpu: "0", memory: "0", gpu: "0", storage: buildStorageVolumes(2, "0") })])
    );

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ message: "A resource unit must request some CPU, memory, GPU or storage", path: ["resources", 0, "resource"] })
    );
  });

  it.each([
    { requested: "CPU", unit: { cpu: "1", memory: "0", gpu: "0", storage: [] } },
    { requested: "memory", unit: { cpu: "0", memory: "1", gpu: "0", storage: [] } },
    { requested: "GPU", unit: { cpu: "0", memory: "0", gpu: "1", storage: [] } },
    { requested: "storage", unit: { cpu: "0", memory: "0", gpu: "0", storage: [...buildStorageVolumes(1, "0"), ...buildStorageVolumes(1, "1")] } }
  ])("accepts a resource unit that requests only $requested", ({ unit }) => {
    const result = BidScreeningRequestSchema.safeParse(buildRequestWithUnits([buildResourceUnit(unit)]));

    expect(result.success).toBe(true);
  });

  function buildRequestWithUnits(resources: ReturnType<typeof buildResourceUnit>[]) {
    return { ...buildRequest(), resources };
  }

  function buildResourceUnit(input?: { count?: number; cpu?: string; memory?: string; gpu?: string; storage?: ReturnType<typeof buildStorageVolumes> }) {
    return {
      resource: {
        id: 1,
        cpu: { units: { val: input?.cpu ?? "1000" } },
        memory: { quantity: { val: input?.memory ?? "1073741824" } },
        gpu: { units: { val: input?.gpu ?? "0" } },
        storage: input?.storage ?? buildStorageVolumes(1, "5368709120"),
        endpoints: []
      },
      count: input?.count ?? 1,
      price: { denom: "uakt", amount: "1000" }
    };
  }

  function buildStorageVolumes(count: number, quantity: string) {
    return Array.from({ length: count }, (_, index) => ({ name: `volume${index}`, quantity: { val: quantity } }));
  }

  function buildAuditors(count: number) {
    return Array.from({ length: count }, (_, index) => `akash1auditor${index}`);
  }

  function buildPlacementAttributes(count: number) {
    return Array.from({ length: count }, (_, index) => ({ key: `region${index}`, value: "us-west" }));
  }

  function buildRequestWithRequirements(requirements: { signedBy: { allOf?: string[]; anyOf?: string[] }; attributes: { key: string; value: string }[] }) {
    return { ...buildRequest(), requirements };
  }

  function buildRequest(cpuAttributes?: { key: string; value: string }[]) {
    return {
      timezone: "America/Chicago",
      requirements: { signedBy: { allOf: [], anyOf: [] }, attributes: [] },
      resources: [
        {
          resource: {
            id: 1,
            cpu: { units: { val: "1000" }, attributes: cpuAttributes },
            memory: { quantity: { val: "1073741824" } },
            gpu: { units: { val: "0" } },
            storage: [{ name: "default", quantity: { val: "5368709120" }, attributes: [{ key: "persistent", value: "false" }] }],
            endpoints: []
          },
          count: 1,
          price: { denom: "uakt", amount: "1000" }
        }
      ]
    };
  }
});
