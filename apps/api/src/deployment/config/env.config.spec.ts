import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("deployment envSchema", () => {
  describe("DEPLOYMENT_DEFAULT_DEPOSIT", () => {
    it("defaults to 0.5 when omitted", () => {
      expect(envSchema.parse(setup()).DEPLOYMENT_DEFAULT_DEPOSIT).toBe(0.5);
    });

    it("accepts a positive value", () => {
      expect(envSchema.parse(setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "1.25" })).DEPLOYMENT_DEFAULT_DEPOSIT).toBe(1.25);
    });

    it("rejects a zero value", () => {
      expect(() => envSchema.parse(setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "0" }))).toThrow();
    });

    it("rejects a negative value", () => {
      expect(() => envSchema.parse(setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "-1" }))).toThrow();
    });

    it("rejects a value that rounds to zero on-chain", () => {
      expect(() => envSchema.parse(setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "0.0000001" }))).toThrow();
    });

    it("rejects a non-finite value", () => {
      expect(() => envSchema.parse(setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "Infinity" }))).toThrow();
    });

    it("rejects a non-numeric value", () => {
      expect(() => envSchema.parse(setup({ DEPLOYMENT_DEFAULT_DEPOSIT: "abc" }))).toThrow();
    });
  });

  describe("AUTO_TOP_UP_TARGET_RUNWAY_IN_H", () => {
    it("accepts the default target runway and look-ahead window", () => {
      const result = envSchema.safeParse(setup());

      expect(result.success).toBe(true);
      expect(result.success && result.data.AUTO_TOP_UP_TARGET_RUNWAY_IN_H).toBe(48);
      expect(result.success && result.data.AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H).toBe(24);
    });

    it("rejects a target runway equal to the look-ahead window", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_TARGET_RUNWAY_IN_H: 24, AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: 24 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].path).toEqual(["AUTO_TOP_UP_TARGET_RUNWAY_IN_H"]);
    });

    it("rejects a target runway below the look-ahead window", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_TARGET_RUNWAY_IN_H: 12, AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: 24 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].path).toEqual(["AUTO_TOP_UP_TARGET_RUNWAY_IN_H"]);
    });

    it("rejects a negative target runway even when it stays above the look-ahead window", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_TARGET_RUNWAY_IN_H: -1, AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: -2 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "AUTO_TOP_UP_TARGET_RUNWAY_IN_H")).toBe(true);
    });

    it("rejects a negative look-ahead window", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: -24 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H")).toBe(true);
    });

    it("accepts a zero look-ahead window", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: 0 }));

      expect(result.success).toBe(true);
    });

    it("rejects an infinite target runway", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_TARGET_RUNWAY_IN_H: "Infinity" }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "AUTO_TOP_UP_TARGET_RUNWAY_IN_H")).toBe(true);
    });

    it("rejects an infinite look-ahead window", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: Infinity }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H")).toBe(true);
    });

    it("accepts a target runway above the look-ahead window", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_TARGET_RUNWAY_IN_H: 36, AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: 12 }));

      expect(result.success).toBe(true);
    });
  });

  function setup(overrides: Record<string, unknown> = {}) {
    return { PROVIDER_PROXY_URL: "https://provider-proxy.example.com", ...overrides };
  }
});
