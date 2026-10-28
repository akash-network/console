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
  it("accepts a replica count up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([buildResourceUnit({ count: MAX_REPLICA_COUNT })]));

    expect(result.success).toBe(true);
  });

  it("rejects a replica count beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([buildResourceUnit({ count: MAX_REPLICA_COUNT + 1 })]));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["resources", 0, "count"] })
    );
  });

  it("accepts resource units up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest(Array.from({ length: MAX_RESOURCE_UNITS }, () => buildResourceUnit())));

    expect(result.success).toBe(true);
  });

  it("rejects resource units beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest(Array.from({ length: MAX_RESOURCE_UNITS + 1 }, () => buildResourceUnit())));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(expect.objectContaining({ code: "too_big", path: ["resources"] }));
  });

  it("accepts storage volumes up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([buildResourceUnit({ storage: buildStorageVolumes(MAX_STORAGE_VOLUMES, "1") })]));

    expect(result.success).toBe(true);
  });

  it("rejects storage volumes beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse(buildRequest([buildResourceUnit({ storage: buildStorageVolumes(MAX_STORAGE_VOLUMES + 1, "1") })]));

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["resources", 0, "resource", "storage"] })
    );
  });

  it("rejects a resource unit that requests no CPU, memory, GPU or storage", () => {
    const result = BidScreeningRequestSchema.safeParse(
      buildRequest([buildResourceUnit({ cpu: "0", memory: "0", gpu: "0", storage: buildStorageVolumes(2, "0") })])
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
    const result = BidScreeningRequestSchema.safeParse(buildRequest([buildResourceUnit(unit)]));

    expect(result.success).toBe(true);
  });

  it.each(["allOf", "anyOf"] as const)("accepts %s auditors up to the cap", list => {
    const result = BidScreeningRequestSchema.safeParse({
      ...buildRequest([buildResourceUnit()]),
      requirements: { signedBy: { [list]: buildAuditors(MAX_SIGNED_BY_AUDITORS) }, attributes: [] }
    });

    expect(result.success).toBe(true);
  });

  it.each(["allOf", "anyOf"] as const)("rejects %s auditors beyond the cap", list => {
    const result = BidScreeningRequestSchema.safeParse({
      ...buildRequest([buildResourceUnit()]),
      requirements: { signedBy: { [list]: buildAuditors(MAX_SIGNED_BY_AUDITORS + 1) }, attributes: [] }
    });

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["requirements", "signedBy", list] })
    );
  });

  it("accepts placement attributes up to the cap", () => {
    const result = BidScreeningRequestSchema.safeParse({
      ...buildRequest([buildResourceUnit()]),
      requirements: { signedBy: {}, attributes: buildPlacementAttributes(MAX_PLACEMENT_ATTRIBUTES) }
    });

    expect(result.success).toBe(true);
  });

  it("rejects placement attributes beyond the cap", () => {
    const result = BidScreeningRequestSchema.safeParse({
      ...buildRequest([buildResourceUnit()]),
      requirements: { signedBy: {}, attributes: buildPlacementAttributes(MAX_PLACEMENT_ATTRIBUTES + 1) }
    });

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["requirements", "attributes"] })
    );
  });

  function buildAuditors(count: number) {
    return Array.from({ length: count }, (_, index) => `akash1auditor${index}`);
  }

  function buildPlacementAttributes(count: number) {
    return Array.from({ length: count }, (_, index) => ({ key: `region${index}`, value: "us-west" }));
  }

  function buildRequest(resources: ReturnType<typeof buildResourceUnit>[]) {
    return {
      timezone: "America/Chicago",
      requirements: { signedBy: { allOf: [], anyOf: [] }, attributes: [] },
      resources
    };
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
});
