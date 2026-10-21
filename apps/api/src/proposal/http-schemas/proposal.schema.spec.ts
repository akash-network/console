import { describe, expect, it } from "vitest";

import { GetProposalByIdParamsSchema } from "./proposal.schema";

describe("GetProposalByIdParamsSchema", () => {
  it("coerces a positive integer id", () => {
    const result = GetProposalByIdParamsSchema.safeParse({ id: "1" });

    expect(result).toEqual({ success: true, data: { id: 1 } });
  });

  it("accepts the largest safe integer id", () => {
    const result = GetProposalByIdParamsSchema.safeParse({ id: String(Number.MAX_SAFE_INTEGER) });

    expect(result).toEqual({ success: true, data: { id: Number.MAX_SAFE_INTEGER } });
  });

  it.each(["0", "-1", "1.5", "abc", "9007199254740992"])("rejects %s", id => {
    const result = GetProposalByIdParamsSchema.safeParse({ id });

    expect(result.success).toBe(false);
  });
});
