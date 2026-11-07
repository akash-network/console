import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("workload abuse env config", () => {
  it("defaults to probing disabled with no signatures", () => {
    const config = setup();

    expect(config.WORKLOAD_ABUSE_PROBE_ENABLED).toBe(false);
    expect(config.WORKLOAD_ABUSE_SIGNATURES).toEqual([]);
    expect(config.WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN).toEqual([5, 20, 60]);
  });

  it("compiles the signature document into case-insensitive regexes tagged with their bucket", () => {
    const config = setup({
      WORKLOAD_ABUSE_PROBE_ENABLED: "true",
      WORKLOAD_ABUSE_SIGNATURES: JSON.stringify({
        hard: [{ category: "stratum-url", pattern: "stratum\\+tcp://" }],
        soft: [{ category: "pool-port", pattern: ":3333\\b", flags: "" }]
      })
    });

    expect(config.WORKLOAD_ABUSE_PROBE_ENABLED).toBe(true);
    expect(config.WORKLOAD_ABUSE_SIGNATURES).toEqual([
      { bucket: "hard", category: "stratum-url", pattern: /stratum\+tcp:\/\//i },
      { bucket: "soft", category: "pool-port", pattern: /:3333\b/ }
    ]);
  });

  it("defaults behavioural signals to off with no relay endpoints", () => {
    const config = setup();

    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_SIGNALS_ENABLED).toBe(false);
    expect(config.WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS).toEqual([]);
    expect(config.WORKLOAD_ABUSE_SIGNAL_ACCEL_MIN_VRAM_MB).toBe(1024);
    expect(config.WORKLOAD_ABUSE_SIGNAL_ARTIFACT_MIN_MB).toBe(256);
  });

  it("defaults behavioural enforcement to off behind a multi-probe agreement", () => {
    const config = setup();

    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_ENFORCEMENT_ENABLED).toBe(false);
    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_AGREEMENT_PROBES).toBe(3);
    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_MIN_WINDOW_MINUTES).toBe(120);
  });

  it("parses the relay endpoint list", () => {
    const config = setup({ WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS: JSON.stringify(["10.0.0.7", "10.0.0.8:443"]) });

    expect(config.WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS).toEqual(["10.0.0.7", "10.0.0.8:443"]);
  });

  it("falls back to no relay endpoints when the variable is set but blank", () => {
    const config = setup({ WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS: "  " });

    expect(config.WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS).toEqual([]);
  });

  it("rejects a relay endpoint list that is not a JSON array of strings", () => {
    expect(() => setup({ WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS: "10.0.0.7" })).toThrow(/ip or ip:port/);
    expect(() => setup({ WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS: JSON.stringify([443]) })).toThrow(/ip or ip:port/);
  });

  it("rejects a signature document that is not JSON", () => {
    expect(() => setup({ WORKLOAD_ABUSE_SIGNATURES: "not json" })).toThrow(/valid signature document/);
  });

  it("rejects a signature whose pattern is not a valid regex", () => {
    const document = JSON.stringify({ hard: [{ category: "broken", pattern: "(" }] });

    expect(() => setup({ WORKLOAD_ABUSE_SIGNATURES: document })).toThrow(/invalid pattern for hard\/broken/);
  });

  it("parses the initial delay list and rejects negative or blank entries", () => {
    expect(setup({ WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN: "2, 10" }).WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN).toEqual([2, 10]);
    expect(() => setup({ WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN: "2,-1" })).toThrow(/non-negative integers/);
    expect(() => setup({ WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN: "1,,2" })).toThrow(/non-negative integers/);
  });

  it("falls back to the default schedule when the initial delay setting is blank", () => {
    expect(setup({ WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN: " " }).WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN).toEqual([5, 20, 60]);
  });

  it("falls back to the behavioural signal defaults when those variables are set but blank", () => {
    const config = setup({
      WORKLOAD_ABUSE_BEHAVIOURAL_SIGNALS_ENABLED: "",
      WORKLOAD_ABUSE_SIGNAL_ACCEL_MIN_VRAM_MB: "",
      WORKLOAD_ABUSE_SIGNAL_ARTIFACT_MIN_MB: " "
    });

    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_SIGNALS_ENABLED).toBe(false);
    expect(config.WORKLOAD_ABUSE_SIGNAL_ACCEL_MIN_VRAM_MB).toBe(1024);
    expect(config.WORKLOAD_ABUSE_SIGNAL_ARTIFACT_MIN_MB).toBe(256);
  });

  it("falls back to the enforcement defaults when those variables are set but blank", () => {
    const config = setup({
      WORKLOAD_ABUSE_BEHAVIOURAL_ENFORCEMENT_ENABLED: "",
      WORKLOAD_ABUSE_BEHAVIOURAL_AGREEMENT_PROBES: "",
      WORKLOAD_ABUSE_BEHAVIOURAL_MIN_WINDOW_MINUTES: " "
    });

    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_ENFORCEMENT_ENABLED).toBe(false);
    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_AGREEMENT_PROBES).toBe(3);
    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_MIN_WINDOW_MINUTES).toBe(120);
  });

  it("still reads the enforcement variables when they carry a value", () => {
    const config = setup({
      WORKLOAD_ABUSE_BEHAVIOURAL_ENFORCEMENT_ENABLED: "true",
      WORKLOAD_ABUSE_BEHAVIOURAL_AGREEMENT_PROBES: "5",
      WORKLOAD_ABUSE_BEHAVIOURAL_MIN_WINDOW_MINUTES: "240"
    });

    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_ENFORCEMENT_ENABLED).toBe(true);
    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_AGREEMENT_PROBES).toBe(5);
    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_MIN_WINDOW_MINUTES).toBe(240);
  });

  it("still reads the behavioural signal variables when they carry a value", () => {
    const config = setup({
      WORKLOAD_ABUSE_BEHAVIOURAL_SIGNALS_ENABLED: "true",
      WORKLOAD_ABUSE_SIGNAL_ACCEL_MIN_VRAM_MB: "2048",
      WORKLOAD_ABUSE_SIGNAL_ARTIFACT_MIN_MB: "512"
    });

    expect(config.WORKLOAD_ABUSE_BEHAVIOURAL_SIGNALS_ENABLED).toBe(true);
    expect(config.WORKLOAD_ABUSE_SIGNAL_ACCEL_MIN_VRAM_MB).toBe(2048);
    expect(config.WORKLOAD_ABUSE_SIGNAL_ARTIFACT_MIN_MB).toBe(512);
  });

  it("leaves the sign-up review off when its variables are unset or blank", () => {
    const unset = setup();
    const blank = setup({ WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: " ", WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL: "" });

    expect(unset.WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES).toBeUndefined();
    expect(unset.WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL).toBeUndefined();
    expect(blank.WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES).toBeUndefined();
    expect(blank.WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL).toBeUndefined();
  });

  it("reads the sign-up review variables when they carry a value", () => {
    const config = setup({
      WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: "7",
      WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL: "https://hooks.slack.test/review"
    });

    expect(config.WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES).toBe(7);
    expect(config.WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL).toBe("https://hooks.slack.test/review");
  });

  it("rejects a sign-up review window that is not a positive integer", () => {
    expect(() => setup({ WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: "0" })).toThrow(/WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES/);
    expect(() => setup({ WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: "1.5" })).toThrow(/WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES/);
  });

  it("requires an account hash secret of at least 32 characters", () => {
    const secret = "s".repeat(32);

    expect(setup({ WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET: secret }).WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET).toBe(secret);
    expect(() => setup({ WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET: "s".repeat(31) })).toThrow(/WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET/);
    expect(() => setup({ WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET: " " })).toThrow(/WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET/);
  });

  function setup(input: Record<string, string> = {}) {
    return envSchema.parse({ WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET: "a".repeat(32), ...input });
  }
});
