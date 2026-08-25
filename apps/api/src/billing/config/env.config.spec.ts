import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

describe("envSchema", () => {
  describe("MASTER_WALLET_AKT_RESERVE", () => {
    it("rejects a negative value", () => {
      const result = setup({ MASTER_WALLET_AKT_RESERVE: "-1" });
      expect(result.success).toBe(false);
    });

    it("rejects a fractional value", () => {
      const result = setup({ MASTER_WALLET_AKT_RESERVE: "1.5" });
      expect(result.success).toBe(false);
    });

    it("accepts a non-negative integer", () => {
      const result = setup({ MASTER_WALLET_AKT_RESERVE: "2000000000" });
      expect(result.success).toBe(true);
    });

    it("accepts zero", () => {
      const result = setup({ MASTER_WALLET_AKT_RESERVE: "0" });
      expect(result.success).toBe(true);
    });
  });

  describe("AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN", () => {
    it("defaults to 60 when absent", () => {
      const result = setup({});
      expect(result.success).toBe(true);
      expect(result.data?.AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN).toBe(60);
    });

    it("coerces a string value", () => {
      const result = setup({ AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN: "30" });
      expect(result.success).toBe(true);
      expect(result.data?.AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN).toBe(30);
    });

    it("accepts zero to disable the cap", () => {
      const result = setup({ AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN: "0" });
      expect(result.success).toBe(true);
    });

    it("rejects a negative value", () => {
      const result = setup({ AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN: "-1" });
      expect(result.success).toBe(false);
    });
  });

  describe("MASTER_WALLET_MAX_MINT_UAKT", () => {
    it("rejects a negative value", () => {
      const result = setup({ MASTER_WALLET_MAX_MINT_UAKT: "-1" });
      expect(result.success).toBe(false);
    });

    it("rejects a fractional value", () => {
      const result = setup({ MASTER_WALLET_MAX_MINT_UAKT: "1.5" });
      expect(result.success).toBe(false);
    });

    it("accepts a non-negative integer", () => {
      const result = setup({ MASTER_WALLET_MAX_MINT_UAKT: "5000000000" });
      expect(result.success).toBe(true);
    });

    it("accepts zero", () => {
      const result = setup({ MASTER_WALLET_MAX_MINT_UAKT: "0" });
      expect(result.success).toBe(true);
    });
  });

  const validEnv = {
    NETWORK: "sandbox",
    RPC_NODE_ENDPOINT: "https://rpc.example.com",
    TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: "1000",
    TRIAL_FEES_ALLOWANCE_AMOUNT: "1000",
    DEPLOYMENT_GRANT_DENOM: "uakt",
    FEE_ALLOWANCE_REFILL_THRESHOLD: "100",
    FEE_ALLOWANCE_REFILL_AMOUNT: "100",
    DEPLOYMENT_ALLOWANCE_REFILL_AMOUNT: "100",
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_PRODUCT_ID: "prod_test",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    CONSOLE_WEB_PAYMENT_LINK: "https://pay.example.com",
    TX_SIGNER_BASE_URL: "https://tx-signer.example.com",
    TX_SIGNER_API_KEY: "test-tx-signer-api-key-placeholder-value"
  };

  function setup(overrides: Record<string, string>) {
    return envSchema.safeParse({ ...validEnv, ...overrides });
  }
});
