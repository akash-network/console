import { describe, expect, it } from "vitest";

import { ProviderDeploymentsParamsSchema } from "./provider-deployments.schema";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe("ProviderDeploymentsParamsSchema", () => {
  describe("skip", () => {
    it.each(["0", "10", String(Number.MAX_SAFE_INTEGER)])("accepts %s", skip => {
      const result = parse({ skip });

      expect(result.data?.skip).toBe(Number(skip));
    });

    it.each(["-1", "1.5", "Infinity", "1e30", "9007199254740992", "abc"])("rejects %s", skip => {
      const result = parse({ skip });

      expect(result.success).toBe(false);
    });
  });

  describe("limit", () => {
    it.each(["1", "100"])("accepts %s", limit => {
      const result = parse({ limit });

      expect(result.data?.limit).toBe(Number(limit));
    });

    it.each(["0", "101", "10.5"])("rejects %s", limit => {
      const result = parse({ limit });

      expect(result.success).toBe(false);
    });
  });

  function parse(input: { skip?: string; limit?: string }) {
    return ProviderDeploymentsParamsSchema.safeParse({ provider: createAkashAddress(), skip: "0", limit: "10", ...input });
  }
});
