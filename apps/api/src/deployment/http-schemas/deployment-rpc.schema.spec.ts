import { describe, expect, it } from "vitest";

import { FallbackDeploymentListQuerySchema } from "./deployment-rpc.schema";

describe("FallbackDeploymentListQuerySchema", () => {
  describe("pagination.limit", () => {
    it("clamps the limit to 100", () => {
      const result = FallbackDeploymentListQuerySchema.parse({ "pagination.limit": "10000" });

      expect(result["pagination.limit"]).toBe(100);
    });

    it("passes a limit at or below 100 through unchanged", () => {
      const result = FallbackDeploymentListQuerySchema.parse({ "pagination.limit": "50" });

      expect(result["pagination.limit"]).toBe(50);
    });

    it("leaves an omitted limit undefined", () => {
      const result = FallbackDeploymentListQuerySchema.parse({});

      expect(result["pagination.limit"]).toBeUndefined();
    });

    it("rejects a negative limit", () => {
      const result = FallbackDeploymentListQuerySchema.safeParse({ "pagination.limit": "-1" });

      expect(result.success).toBe(false);
    });
  });

  describe("pagination.offset", () => {
    it("rejects a negative offset", () => {
      const result = FallbackDeploymentListQuerySchema.safeParse({ "pagination.offset": "-1" });

      expect(result.success).toBe(false);
    });

    it("rejects a non-finite offset", () => {
      const result = FallbackDeploymentListQuerySchema.safeParse({ "pagination.offset": "Infinity" });

      expect(result.success).toBe(false);
    });

    it("accepts the largest safe integer offset", () => {
      const result = FallbackDeploymentListQuerySchema.parse({ "pagination.offset": String(Number.MAX_SAFE_INTEGER) });

      expect(result["pagination.offset"]).toBe(Number.MAX_SAFE_INTEGER);
    });

    it.each(["9007199254740992", "1e30"])("rejects an offset of %s", offset => {
      const result = FallbackDeploymentListQuerySchema.safeParse({ "pagination.offset": offset });

      expect(result.success).toBe(false);
    });
  });

  describe("pagination.key", () => {
    it.each(["", "0", "100", "999999999999999"])("accepts %j", key => {
      const result = FallbackDeploymentListQuerySchema.parse({ "pagination.key": key });

      expect(result["pagination.key"]).toBe(key);
    });

    it.each(["-1", "abc", "1.5", "12abc", "1000000000000000"])("rejects %j", key => {
      const result = FallbackDeploymentListQuerySchema.safeParse({ "pagination.key": key });

      expect(result.success).toBe(false);
    });
  });
});
