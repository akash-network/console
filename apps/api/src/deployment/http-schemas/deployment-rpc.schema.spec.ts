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
  });
});
