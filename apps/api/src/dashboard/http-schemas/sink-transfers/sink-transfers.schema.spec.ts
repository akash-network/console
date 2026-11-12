import { describe, expect, it } from "vitest";

import { SinkTransfersQuerySchema } from "./sink-transfers.schema";

describe("SinkTransfersQuerySchema", () => {
  it("returns the first 20 most recent transfers by default", () => {
    const result = SinkTransfersQuerySchema.safeParse({});

    expect(result.data).toEqual({ skip: 0, limit: 20, sort: "latest" });
  });

  describe("skip", () => {
    it.each(["0", "10", String(Number.MAX_SAFE_INTEGER)])("accepts %s", skip => {
      const result = SinkTransfersQuerySchema.safeParse({ skip });

      expect(result.data?.skip).toBe(Number(skip));
    });

    it.each(["-1", "1.5", "Infinity", "1e30", "9007199254740992", "abc"])("rejects %s", skip => {
      const result = SinkTransfersQuerySchema.safeParse({ skip });

      expect(result.success).toBe(false);
    });
  });

  describe("limit", () => {
    it.each(["1", "100"])("accepts %s", limit => {
      const result = SinkTransfersQuerySchema.safeParse({ limit });

      expect(result.data?.limit).toBe(Number(limit));
    });

    it.each(["0", "101", "10.5"])("rejects %s", limit => {
      const result = SinkTransfersQuerySchema.safeParse({ limit });

      expect(result.success).toBe(false);
    });
  });

  describe("sort", () => {
    it.each(["latest", "largest"])("accepts %s", sort => {
      const result = SinkTransfersQuerySchema.safeParse({ sort });

      expect(result.data?.sort).toBe(sort);
    });

    it.each(["oldest", "amount", ""])("rejects %s", sort => {
      const result = SinkTransfersQuerySchema.safeParse({ sort });

      expect(result.success).toBe(false);
    });
  });
});
