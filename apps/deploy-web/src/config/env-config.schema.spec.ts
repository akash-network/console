import { describe, expect, it } from "vitest";

import { browserEnvSchema } from "./env-config.schema";

describe("browserEnvSchema", () => {
  it("defaults the support link to the Discord invite instead of the discord.akash.network redirect", () => {
    expect(browserEnvSchema.shape.NEXT_PUBLIC_CONTACT_SUPPORT_URL.parse(undefined)).toBe("https://discord.gg/akash");
  });

  it("defaults the trial size caps to the api's 4 vCPU and 16 GiB", () => {
    expect(browserEnvSchema.shape.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU.parse(undefined)).toBe(4);
    expect(browserEnvSchema.shape.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI.parse(undefined)).toBe(16);
  });

  it("reads the trial size caps from their env strings", () => {
    expect(browserEnvSchema.shape.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU.parse("8")).toBe(8);
    expect(browserEnvSchema.shape.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI.parse("0")).toBe(0);
  });

  it("refuses a negative trial size cap", () => {
    expect(browserEnvSchema.shape.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU.safeParse("-1").success).toBe(false);
    expect(browserEnvSchema.shape.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI.safeParse("-1").success).toBe(false);
  });
});
