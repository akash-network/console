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

  describe("RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H", () => {
    it("defaults to a lead of 6h and a minimum limit of 12h", () => {
      const result = envSchema.safeParse(setup());

      expect(result.success).toBe(true);
      expect(result.success && result.data.RUNTIME_LIMIT_WARNING_LEAD_IN_H).toBe(6);
      expect(result.success && result.data.RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H).toBe(12);
    });

    it("accepts a minimum limit of exactly twice the lead", () => {
      const result = envSchema.safeParse(setup({ RUNTIME_LIMIT_WARNING_LEAD_IN_H: 4, RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H: 8 }));

      expect(result.success).toBe(true);
    });

    it("rejects a minimum limit below twice the lead", () => {
      const result = envSchema.safeParse(setup({ RUNTIME_LIMIT_WARNING_LEAD_IN_H: 6, RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H: 8 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].path).toEqual(["RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H"]);
    });

    it("rejects a zero lead", () => {
      const result = envSchema.safeParse(setup({ RUNTIME_LIMIT_WARNING_LEAD_IN_H: 0 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "RUNTIME_LIMIT_WARNING_LEAD_IN_H")).toBe(true);
    });

    it("rejects an infinite lead", () => {
      const result = envSchema.safeParse(setup({ RUNTIME_LIMIT_WARNING_LEAD_IN_H: "Infinity" }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "RUNTIME_LIMIT_WARNING_LEAD_IN_H")).toBe(true);
    });
  });

  describe("AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD", () => {
    it("defaults to 5 when omitted", () => {
      const result = envSchema.safeParse(setup());

      expect(result.success).toBe(true);
      expect(result.success && result.data.AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD).toBe(5);
    });

    it("accepts a zero headroom", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD: 0 }));

      expect(result.success).toBe(true);
    });

    it("rejects a negative headroom", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD: -5 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD")).toBe(true);
    });

    it("rejects an infinite headroom, which would waive the floor and spend the whole balance", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD: Infinity }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD")).toBe(true);
    });

    it("rejects a headroom coerced from an infinite string", () => {
      const result = envSchema.safeParse(setup({ AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD: "Infinity" }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD")).toBe(true);
    });
  });

  describe("orphan sweep", () => {
    it("leaves a definition alone for an hour, far longer than a create takes to reach the chain", () => {
      const result = envSchema.safeParse(setup());

      expect(result.success).toBe(true);
      expect(result.success && result.data.ORPHANED_DEFINITION_SWEEP_GRACE_IN_H).toBe(1);
    });

    it("rejects a zero grace, which would let the sweep race a create still in flight", () => {
      const result = envSchema.safeParse(setup({ ORPHANED_DEFINITION_SWEEP_GRACE_IN_H: 0 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "ORPHANED_DEFINITION_SWEEP_GRACE_IN_H")).toBe(true);
    });

    it("reads 500 records per page and keeps paging for 20 minutes, which bounds a run by time rather than by coverage", () => {
      const result = envSchema.safeParse(setup());

      expect(result.success).toBe(true);
      expect(result.success && result.data.ORPHANED_DEFINITION_SWEEP_PAGE_SIZE).toBe(500);
      expect(result.success && result.data.ORPHANED_DEFINITION_SWEEP_BUDGET_IN_MIN).toBe(20);
    });

    it("rejects a zero budget, which would stop a run before its first page", () => {
      const result = envSchema.safeParse(setup({ ORPHANED_DEFINITION_SWEEP_BUDGET_IN_MIN: 0 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "ORPHANED_DEFINITION_SWEEP_BUDGET_IN_MIN")).toBe(true);
    });

    it("rejects a zero page size, which would read nothing on every page", () => {
      const result = envSchema.safeParse(setup({ ORPHANED_DEFINITION_SWEEP_PAGE_SIZE: 0 }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "ORPHANED_DEFINITION_SWEEP_PAGE_SIZE")).toBe(true);
    });
  });

  function setup(overrides: Record<string, unknown> = {}) {
    return {
      PROVIDER_PROXY_URL: "https://provider-proxy.example.com",
      DEPLOY_WEB_BASE_URL: "https://console.example.com",
      GCP_KMS_AUTH: JSON.stringify({ project_id: "console-test", servicePath: "http://localhost:8085" }),
      ...overrides
    };
  }
});
