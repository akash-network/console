import { z } from "zod";

import { AUDITOR } from "@src/deployment/config/provider.config";

export const envSchema = z.object({
  MASTER_WALLET_MNEMONIC: z.string(),
  NETWORK: z.enum(["mainnet", "testnet", "sandbox"]),
  RPC_NODE_ENDPOINT: z.string(),
  TRIAL_ALLOWANCE_EXPIRATION_DAYS: z.number({ coerce: true }).default(30),
  TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: z.number({ coerce: true }),
  TRIAL_FEES_ALLOWANCE_AMOUNT: z.number({ coerce: true }),
  TRIAL_DEPLOYMENT_CLEANUP_HOURS: z.number({ coerce: true }).default(24),
  DEPLOYMENT_GRANT_DENOM: z.string(),
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
  STRIPE_CHECKOUT_REDIRECT_URL: z.string(),
  STRIPE_ENABLE_COUPONS: z.enum(["true", "false"]).default("false"),
  CONSOLE_WEB_PAYMENT_LINK: z.string(),
  MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: z
    .string()
    .default(AUDITOR)
    .transform(val => (val ? val.split(",").map(addr => addr.trim()) : []))
});

export const envConfig = envSchema.parse(process.env);
