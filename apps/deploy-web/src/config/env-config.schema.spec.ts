import { describe, expect, it } from "vitest";

import { browserEnvSchema } from "./env-config.schema";

describe("browserEnvSchema", () => {
  it("defaults the support link to the Discord invite instead of the discord.akash.network redirect", () => {
    expect(browserEnvSchema.shape.NEXT_PUBLIC_CONTACT_SUPPORT_URL.parse(undefined)).toBe("https://discord.gg/akash");
  });
});
