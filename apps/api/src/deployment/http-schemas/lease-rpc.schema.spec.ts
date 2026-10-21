import { describe, expect, it } from "vitest";

import { FallbackLeaseListQuerySchema } from "./lease-rpc.schema";

describe("FallbackLeaseListQuerySchema", () => {
  describe("pagination.limit", () => {
    it("clamps the limit to 100", () => {
      const result = FallbackLeaseListQuerySchema.parse({ "pagination.limit": "1000000" });

      expect(result["pagination.limit"]).toBe(100);
    });

    it("passes a limit at or below 100 through unchanged", () => {
      const result = FallbackLeaseListQuerySchema.parse({ "pagination.limit": "100" });

      expect(result["pagination.limit"]).toBe(100);
    });

    it("leaves an omitted limit undefined", () => {
      const result = FallbackLeaseListQuerySchema.parse({});

      expect(result["pagination.limit"]).toBeUndefined();
    });

    it("accepts a zero limit", () => {
      const result = FallbackLeaseListQuerySchema.parse({ "pagination.limit": "0" });

      expect(result["pagination.limit"]).toBe(0);
    });

    it("rejects a negative limit", () => {
      const result = FallbackLeaseListQuerySchema.safeParse({ "pagination.limit": "-1" });

      expect(result.success).toBe(false);
    });
  });

  describe("pagination.offset", () => {
    it("accepts a zero offset", () => {
      const result = FallbackLeaseListQuerySchema.parse({ "pagination.offset": "0" });

      expect(result["pagination.offset"]).toBe(0);
    });

    it("rejects a negative offset", () => {
      const result = FallbackLeaseListQuerySchema.safeParse({ "pagination.offset": "-1" });

      expect(result.success).toBe(false);
    });

    it("rejects a non-finite offset", () => {
      const result = FallbackLeaseListQuerySchema.safeParse({ "pagination.offset": "Infinity" });

      expect(result.success).toBe(false);
    });

    it("accepts the largest safe integer offset", () => {
      const result = FallbackLeaseListQuerySchema.parse({ "pagination.offset": String(Number.MAX_SAFE_INTEGER) });

      expect(result["pagination.offset"]).toBe(Number.MAX_SAFE_INTEGER);
    });

    it.each(["9007199254740992", "1e30"])("rejects an offset of %s", offset => {
      const result = FallbackLeaseListQuerySchema.safeParse({ "pagination.offset": offset });

      expect(result.success).toBe(false);
    });
  });
});
