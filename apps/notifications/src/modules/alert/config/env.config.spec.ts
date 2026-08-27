import { describe, expect, it } from "vitest";

import { schema } from "@src/modules/alert/config/env.config";

const baseEnv = {
  API_NODE_ENDPOINT: "https://rpc.akt.dev/rest",
  CONSOLE_WEB_URL: "console.akash.network"
};

describe("alert environment config", () => {
  it("disables maintenance alerts by default", () => {
    expect(schema.parse(baseEnv).PROVIDER_MAINTENANCE_ALERTS_ENABLED).toBe(false);
  });

  it("enables maintenance alerts without a Console API dependency", () => {
    const result = schema.parse({ ...baseEnv, PROVIDER_MAINTENANCE_ALERTS_ENABLED: "true" });

    expect(result.PROVIDER_MAINTENANCE_ALERTS_ENABLED).toBe(true);
  });

  it("disables provider tier-demotion alerts by default", () => {
    expect(schema.parse(baseEnv).PROVIDER_TIER_DEMOTION_ALERTS_ENABLED).toBe(false);
  });

  it("requires the Console API only when provider tier-demotion alerts are enabled", () => {
    expect(() => schema.parse({ ...baseEnv, PROVIDER_TIER_DEMOTION_ALERTS_ENABLED: "true" })).toThrow("CONSOLE_API_ENDPOINT is required");

    const result = schema.parse({
      ...baseEnv,
      CONSOLE_API_ENDPOINT: "https://api.akash.network",
      PROVIDER_TIER_DEMOTION_ALERTS_ENABLED: "true"
    });
    expect(result.PROVIDER_TIER_DEMOTION_ALERTS_ENABLED).toBe(true);
  });
});
