import dotenv from "dotenv";
import { z } from "zod";

import { isX402TestnetNetwork } from "@src/billing/config/x402-networks";
import { AUDITOR } from "@src/deployment/config/provider.config";

dotenv.config({ path: "env/.env.funding-wallet-index" });

const baseEnvSchema = z.object({
  OLD_MASTER_WALLET_MNEMONIC: z.string().optional(),
  FUNDING_WALLET_MNEMONIC: z.string().optional(),
  FUNDING_WALLET_MNEMONIC_V1: z.string().optional(),
  FUNDING_WALLET_MNEMONIC_V2: z.string().optional(),
  DERIVATION_WALLET_MNEMONIC: z.string().optional(),
  DERIVATION_WALLET_MNEMONIC_V1: z.string().optional(),
  DERIVATION_WALLET_MNEMONIC_V2: z.string().optional(),
  NETWORK: z.enum(["mainnet", "testnet", "sandbox"]),
  RPC_NODE_ENDPOINT: z.string(),
  TRIAL_ALLOWANCE_EXPIRATION_DAYS: z.number({ coerce: true }).default(30),
  TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: z.number({ coerce: true }),
  TRIAL_FEES_ALLOWANCE_AMOUNT: z.number({ coerce: true }),
  TRIAL_DEPLOYMENT_CLEANUP_HOURS: z.number({ coerce: true }).default(24),
  DEPLOYMENT_GRANT_DENOM: z.enum(["uakt", "uact"]),
  GAS_SAFETY_MULTIPLIER: z.number({ coerce: true }).default(1.8),
  AVERAGE_GAS_PRICE: z.number({ coerce: true }).default(0.025),
  FEE_ALLOWANCE_REFILL_THRESHOLD: z.number({ coerce: true }),
  FEE_ALLOWANCE_REFILL_AMOUNT: z.number({ coerce: true }),
  DEPLOYMENT_ALLOWANCE_REFILL_AMOUNT: z.number({ coerce: true }),
  ALLOWANCE_REFILL_BATCH_SIZE: z.number({ coerce: true }).default(10),
  WALLET_BATCHING_INTERVAL_MS: z.number().optional().default(1000),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_PRODUCT_ID: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  STRIPE_ENABLE_COUPONS: z.enum(["true", "false"]).default("false"),
  CONSOLE_WEB_PAYMENT_LINK: z.string(),
  MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: z
    .string()
    .default(AUDITOR)
    .transform(val => (val ? val.split(",").map(addr => addr.trim()) : [])),
  MANAGED_WALLET_TRIAL_MIN_TOP_UP_AMOUNT: z.number({ coerce: true }).min(20).default(20),
  MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: z
    .string()
    .default("nvidia/b300,nvidia/b200,nvidia/h200,nvidia/h100,nvidia/pro6000se,nvidia/pro6000we,nvidia/a100,nvidia/rtx5090,nvidia/rtx4090,nvidia/rtx3090")
    .transform(val =>
      val
        ? val
            .split(",")
            .map(entry => entry.trim().toLowerCase())
            .filter(Boolean)
        : []
    )
    .refine(entries => entries.every(entry => /^[a-z0-9._-]+\/[a-z0-9._-]+$/.test(entry)), {
      message: "MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS entries must be in 'vendor/model' format"
    }),
  MASTER_WALLET_TARGET_ACT_BALANCE: z.number({ coerce: true }).default(10_000_000_000),
  TX_SIGNER_BASE_URL: z.string(),
  X402_ENABLED: z.enum(["true", "false"]).default("false"),
  X402_PAY_TO_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "X402_PAY_TO_ADDRESS must be an EVM address")
    .optional(),
  X402_NETWORK: z
    .string()
    .regex(/^[a-z0-9-]+:[a-zA-Z0-9-_]+$/, "X402_NETWORK must be a CAIP-2 network id, e.g. eip155:8453")
    .default("eip155:8453")
    .transform(value => value as `${string}:${string}`),
  X402_FACILITATOR_URL: z.string().default("https://x402.org/facilitator"),
  X402_MIN_TOP_UP_USD: z.number({ coerce: true }).default(1),
  X402_MAX_TOP_UP_USD: z.number({ coerce: true }).default(1000)
});

/**
 * Sandbox firewall: a testnet x402 settlement network must never be paired with a
 * mainnet Akash `NETWORK`, otherwise a testnet payment (worthless funds) could settle
 * and credit a real mainnet balance. Enforced at config-parse time so a misconfigured
 * deployment fails fast at startup instead of silently crediting free credits.
 */
export const envSchema = baseEnvSchema.superRefine((config, ctx) => {
  if (config.NETWORK === "mainnet" && isX402TestnetNetwork(config.X402_NETWORK)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["X402_NETWORK"],
      message: `X402_NETWORK "${config.X402_NETWORK}" is a testnet network and cannot be used while NETWORK is "mainnet": a testnet settlement must never credit a mainnet balance. Use a mainnet X402_NETWORK (e.g. eip155:8453) or run with NETWORK=sandbox/testnet.`
    });
  }
});

export type BillingConfig = z.infer<typeof envSchema>;
