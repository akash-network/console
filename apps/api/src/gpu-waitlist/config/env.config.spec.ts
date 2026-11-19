import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  it("defaults every waitlist setting", () => {
    expect(envSchema.parse({})).toEqual({
      GPU_WAITLIST_NETWORKS: ["mainnet"],
      GPU_WAITLIST_POLL_SECONDS: 60,
      GPU_WAITLIST_BID_EVIDENCE_DAYS: 7,
      GPU_WAITLIST_CHECK_COOLDOWN_MINUTES: 15,
      GPU_WAITLIST_WAVE_MULTIPLIER: 3,
      GPU_WAITLIST_WAVE_WINDOW_MINUTES: 10,
      GPU_WAITLIST_MAX_EMAILS_PER_ENTRY_PER_DAY: 2,
      GPU_WAITLIST_MAX_ACTIVE_ENTRIES: 10,
      GPU_WAITLIST_JOIN_HOURLY_LIMIT: 10,
      GPU_WAITLIST_JOIN_DAILY_LIMIT: 30,
      GPU_WAITLIST_STILL_WANTED_DAYS: 30,
      GPU_WAITLIST_STILL_WANTED_GRACE_DAYS: 7
    });
  });

  it("reads numeric settings from string environment values", () => {
    const config = envSchema.parse({ GPU_WAITLIST_POLL_SECONDS: "30", GPU_WAITLIST_WAVE_MULTIPLIER: "5" });

    expect(config.GPU_WAITLIST_POLL_SECONDS).toBe(30);
    expect(config.GPU_WAITLIST_WAVE_MULTIPLIER).toBe(5);
  });

  it("reads the networks that run waitlists from a comma separated list", () => {
    expect(envSchema.parse({ GPU_WAITLIST_NETWORKS: "mainnet, sandbox" }).GPU_WAITLIST_NETWORKS).toEqual(["mainnet", "sandbox"]);
  });

  it.each([
    { GPU_WAITLIST_NETWORKS: "devnet" },
    { GPU_WAITLIST_NETWORKS: "" },
    { GPU_WAITLIST_POLL_SECONDS: "0" },
    { GPU_WAITLIST_MAX_ACTIVE_ENTRIES: "1.5" },
    { GPU_WAITLIST_JOIN_DAILY_LIMIT: "-1" }
  ])("rejects %o", env => {
    expect(envSchema.safeParse(env).success).toBe(false);
  });
});
