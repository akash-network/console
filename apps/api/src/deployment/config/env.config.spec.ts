import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("deployment envSchema", () => {
  describe("DEPLOYMENT_DEFAULT_DEPOSIT", () => {
    it("defaults to 0.5 when omitted", () => {
      const config = setup();
      expect(config.DEPLOYMENT_DEFAULT_DEPOSIT).toBe(0.5);
    });

    it("accepts a positive value", () => {
      const config = setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "1.25" });
      expect(config.DEPLOYMENT_DEFAULT_DEPOSIT).toBe(1.25);
    });

    it("rejects a zero value", () => {
      expect(() => setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "0" })).toThrow();
    });

    it("rejects a negative value", () => {
      expect(() => setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "-1" })).toThrow();
    });

    it("rejects a value that rounds to zero on-chain", () => {
      expect(() => setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "0.0000001" })).toThrow();
    });

    it("rejects a non-finite value", () => {
      expect(() => setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "Infinity" })).toThrow();
    });

    it("rejects a non-numeric value", () => {
      expect(() => setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "abc" })).toThrow();
    });
  });

  function setup(input?: { DEPLOYMENT_DEFAULT_DEPOSIT?: string }) {
    return envSchema.parse({
      PROVIDER_PROXY_URL: "https://provider-proxy.test",
      ...input
    });
  }
});
