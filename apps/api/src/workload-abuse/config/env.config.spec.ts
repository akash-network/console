import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("workload abuse env config", () => {
  it("defaults to probing disabled with no signatures", () => {
    const config = envSchema.parse({});

    expect(config.WORKLOAD_ABUSE_PROBE_ENABLED).toBe(false);
    expect(config.WORKLOAD_ABUSE_SIGNATURES).toEqual([]);
    expect(config.WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN).toEqual([5, 20, 60]);
  });

  it("compiles the signature document into case-insensitive regexes tagged with their bucket", () => {
    const config = envSchema.parse({
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

  it("rejects a signature document that is not JSON", () => {
    expect(() => envSchema.parse({ WORKLOAD_ABUSE_SIGNATURES: "not json" })).toThrow(/valid signature document/);
  });

  it("rejects a signature whose pattern is not a valid regex", () => {
    const document = JSON.stringify({ hard: [{ category: "broken", pattern: "(" }] });

    expect(() => envSchema.parse({ WORKLOAD_ABUSE_SIGNATURES: document })).toThrow(/invalid pattern for hard\/broken/);
  });

  it("parses the initial delay list and rejects negative entries", () => {
    expect(envSchema.parse({ WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN: "2, 10" }).WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN).toEqual([2, 10]);
    expect(() => envSchema.parse({ WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN: "2,-1" })).toThrow(/non-negative integers/);
  });
});
