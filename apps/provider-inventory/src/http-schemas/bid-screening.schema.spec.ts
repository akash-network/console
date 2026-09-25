import { describe, expect, it } from "vitest";

import { BidScreeningRequestSchema, MAX_PLACEMENT_ATTRIBUTES, MAX_SIGNED_BY_AUDITORS } from "./bid-screening.schema";

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
