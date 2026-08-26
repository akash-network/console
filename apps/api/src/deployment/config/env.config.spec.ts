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

  describe("PROVIDER_OUTAGE_FRESHNESS_WINDOW_IN_H", () => {
    it("defaults to trusting outages the inventory re-checked within 3 hours", () => {
      const result = envSchema.safeParse(setup());

      expect(result.success).toBe(true);
      expect(result.success && result.data.PROVIDER_OUTAGE_FRESHNESS_WINDOW_IN_H).toBe(3);
    });

    it("rejects an unbounded freshness window, which would trust an outage record nobody maintains", () => {
      const result = envSchema.safeParse(setup({ PROVIDER_OUTAGE_FRESHNESS_WINDOW_IN_H: Infinity }));

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "PROVIDER_OUTAGE_FRESHNESS_WINDOW_IN_H")).toBe(true);
    });

    it("requires somewhere to read the outage record from", () => {
      const config = setup();
      delete (config as Record<string, unknown>).PROVIDER_INVENTORY_API_URL;

      const result = envSchema.safeParse(config);

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues.some(issue => issue.path[0] === "PROVIDER_INVENTORY_API_URL")).toBe(true);
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

  describe("UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN", () => {
    it("defaults to an hour when omitted", () => {
      expect(envSchema.parse(setup()).UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN).toBe(60);
    });

    it("accepts a longer grace, which only ever delays a deletion", () => {
      expect(envSchema.parse(setup({ UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: "720" })).UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN).toBe(720);
    });

    it("accepts the shortest grace on the floor", () => {
      expect(envSchema.parse(setup({ UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: 15 })).UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN).toBe(15);
    });

    it("rejects a grace below the floor, which would delete creates still in flight", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: 14 }), "UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN");
    });

    it("rejects a fraction of a minute coerced from a string", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: "0.01" }), "UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN");
    });

    it("rejects a zero grace", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: 0 }), "UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN");
    });

    it("rejects a negative grace", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: -60 }), "UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN");
    });

    it("rejects an infinite grace", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: "Infinity" }), "UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN");
    });

    it("rejects a non-numeric grace", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: "soon" }), "UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN");
    });
  });

  describe("UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT", () => {
    it("defaults to 47 retries, a horizon of 48 attempts, when omitted", () => {
      expect(envSchema.parse(setup()).UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT).toBe(47);
    });

    it("accepts a single retry", () => {
      expect(envSchema.parse(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT: "1" })).UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT).toBe(1);
    });

    it("rejects no retries at all, which would leak on the first chain hiccup", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT: 0 }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT");
    });

    it("rejects a fractional retry count", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT: 2.5 }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT");
    });

    it("rejects a negative retry count", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT: -1 }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT");
    });

    it("rejects a non-numeric retry count", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT: "many" }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT");
    });
  });

  describe("UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC", () => {
    it("defaults to half a minute when omitted", () => {
      expect(envSchema.parse(setup()).UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC).toBe(30);
    });

    it("accepts a one second first gap", () => {
      expect(envSchema.parse(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC: "1" })).UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC).toBe(1);
    });

    it("rejects a zero first gap, which collapses the whole backoff to nothing", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC: 0 }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC");
    });

    it("rejects a fractional first gap, which pg-boss stores as whole seconds", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC: 0.5 }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC");
    });

    it("rejects a negative first gap", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC: -30 }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC");
    });

    it("rejects a non-numeric first gap", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC: "soon" }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC");
    });
  });

  describe("UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN", () => {
    it("defaults to half an hour when omitted", () => {
      expect(envSchema.parse(setup()).UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN).toBe(30);
    });

    it("accepts a tighter ceiling", () => {
      expect(envSchema.parse(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: "5" })).UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN).toBe(5);
    });

    it("rejects a zero ceiling, which would cap every gap at nothing", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: 0 }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN");
    });

    it("rejects a negative ceiling", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: -30 }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN");
    });

    it("rejects an infinite ceiling", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: "Infinity" }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN");
    });

    it("rejects a non-numeric ceiling", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: "long" }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN");
    });

    it("accepts half a minute, which is a whole number of seconds", () => {
      expect(envSchema.parse(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: 0.5 })).UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN).toBe(0.5);
    });

    it("accepts a quarter of a minute, which is a whole number of seconds", () => {
      expect(envSchema.parse(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: "0.25" })).UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN).toBe(
        0.25
      );
    });

    it("rejects a ceiling that converts to a fraction of a second, which the integer column would refuse", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: 1.01 }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN");
    });

    it("rejects a fractional ceiling coerced from a string", () => {
      expectRejected(setup({ UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: "1.01" }), "UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN");
    });
  });

  function expectRejected(env: Record<string, unknown>, key: string) {
    const result = envSchema.safeParse(env);

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.some(issue => issue.path[0] === key)).toBe(true);
  }

  function setup(overrides: Record<string, unknown> = {}) {
    return {
      PROVIDER_PROXY_URL: "https://provider-proxy.example.com",
      PROVIDER_INVENTORY_API_URL: "https://provider-inventory.example.com",
      DEPLOY_WEB_BASE_URL: "https://console.example.com",
      GCP_KMS_AUTH: JSON.stringify({ project_id: "console-test", servicePath: "http://localhost:8085" }),
      ...overrides
    };
  }
});
