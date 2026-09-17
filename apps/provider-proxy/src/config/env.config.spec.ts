import { describe, expect, it } from "vitest";

import type { AppConfigInput } from "./env.config";
import { appConfigSchema } from "./env.config";

describe("appConfigSchema", () => {
  it("rejects a max cooldown shorter than the base cooldown", () => {
    const result = appConfigSchema.safeParse(setup({ PROVIDER_UNREACHABLE_COOLDOWN_MS: 60_000, PROVIDER_UNREACHABLE_MAX_COOLDOWN_MS: 30_000 }));

    expect(result.success).toBe(false);
  });

  it("accepts a max cooldown equal to the base cooldown", () => {
    const result = appConfigSchema.safeParse(setup({ PROVIDER_UNREACHABLE_COOLDOWN_MS: 60_000, PROVIDER_UNREACHABLE_MAX_COOLDOWN_MS: 60_000 }));

    expect(result.success).toBe(true);
  });

  it("accepts the defaults", () => {
    const result = appConfigSchema.safeParse(setup({}));

    expect(result.success).toBe(true);
  });

  function setup(input: Partial<AppConfigInput>) {
    return { REST_API_NODE_URL: "https://rest.example.com", ...input };
  }
});
