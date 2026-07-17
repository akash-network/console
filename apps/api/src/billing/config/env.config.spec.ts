import { describe, expect, it } from "vitest";

import { envSchema } from "@src/billing/config/env.config";

describe("billing envSchema x402 sandbox firewall", () => {
  it("rejects a testnet X402_NETWORK when NETWORK is mainnet", () => {
    const result = envSchema.safeParse(baseEnv({ NETWORK: "mainnet", X402_NETWORK: "eip155:84532" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.path.includes("X402_NETWORK"));
      expect(issue?.message).toContain("testnet");
    }
  });

  it("accepts a testnet X402_NETWORK when NETWORK is sandbox", () => {
    const result = envSchema.safeParse(baseEnv({ NETWORK: "sandbox", X402_NETWORK: "eip155:84532" }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.X402_NETWORK).toBe("eip155:84532");
    }
  });

  it("accepts a testnet X402_NETWORK when NETWORK is testnet", () => {
    const result = envSchema.safeParse(baseEnv({ NETWORK: "testnet", X402_NETWORK: "eip155:84532" }));

    expect(result.success).toBe(true);
  });

  it("accepts a mainnet X402_NETWORK when NETWORK is mainnet", () => {
    const result = envSchema.safeParse(baseEnv({ NETWORK: "mainnet", X402_NETWORK: "eip155:8453" }));

    expect(result.success).toBe(true);
  });

  it("accepts the default mainnet X402_NETWORK on a sandbox deployment", () => {
    const env = baseEnv({ NETWORK: "sandbox" });
    delete env.X402_NETWORK;

    const result = envSchema.safeParse(env);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.X402_NETWORK).toBe("eip155:8453");
    }
  });

  function baseEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      NETWORK: "sandbox",
      RPC_NODE_ENDPOINT: "https://rpc.example.com",
      TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: 10,
      TRIAL_FEES_ALLOWANCE_AMOUNT: 10,
      DEPLOYMENT_GRANT_DENOM: "uakt",
      FEE_ALLOWANCE_REFILL_THRESHOLD: 1,
      FEE_ALLOWANCE_REFILL_AMOUNT: 1,
      DEPLOYMENT_ALLOWANCE_REFILL_AMOUNT: 1,
      STRIPE_SECRET_KEY: "sk_test",
      STRIPE_PRODUCT_ID: "prod_test",
      STRIPE_WEBHOOK_SECRET: "whsec_test",
      CONSOLE_WEB_PAYMENT_LINK: "https://console.example.com/pay",
      TX_SIGNER_BASE_URL: "https://tx-signer.example.com",
      X402_ENABLED: "true",
      X402_PAY_TO_ADDRESS: "0x1111111111111111111111111111111111111111",
      X402_NETWORK: "eip155:8453",
      ...overrides
    };
  }
});
