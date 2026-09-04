import { describe, expect, it } from "vitest";

import { BidScreeningRequestSchema } from "./bid-screening.schema";

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
