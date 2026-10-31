import { describe, expect, it } from "vitest";

import { openApiExampleProviderAddress } from "@src/utils/constants";
import { CreateLeaseRequestSchema, MAX_LEASES_PER_REQUEST } from "./lease.schema";

describe("CreateLeaseRequestSchema", () => {
  it("accepts leases up to the cap", () => {
    const result = CreateLeaseRequestSchema.safeParse({ leases: buildLeases(MAX_LEASES_PER_REQUEST) });

    expect(result.success).toBe(true);
  });

  it("rejects leases beyond the cap", () => {
    const result = CreateLeaseRequestSchema.safeParse({ leases: buildLeases(MAX_LEASES_PER_REQUEST + 1) });

    expect(result.success).toBe(false);
    expect((result as { error: { issues: unknown[] } }).error.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: ["leases"], message: `A request can create at most ${MAX_LEASES_PER_REQUEST} leases` })
    );
  });

  it("rejects an empty lease list", () => {
    const result = CreateLeaseRequestSchema.safeParse({ leases: [] });

    expect(result.success).toBe(false);
  });

  function buildLeases(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      dseq: "1234567",
      gseq: index + 1,
      oseq: 1,
      provider: openApiExampleProviderAddress
    }));
  }
});
