import dotenv from "dotenv";
import { z } from "zod";

import { AUDITOR } from "@src/deployment/config/provider.config";

dotenv.config({ path: "env/.env.funding-wallet-index" });

export const envSchema = z.object({
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
  /**
   * Minimum minutes between automatic threshold-mode card charges per wallet — the default of 60
   * caps them at one per hour. 0 disables the cap (unlike AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN, which
   * has no disable semantics).
   */
  AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN: z.number({ coerce: true }).min(0).default(60),
  /** How long credits must keep reading sufficient before the low-credit email unlatches, so a single misread cannot unlatch it. */
  CREDITS_LOW_RECOVERY_CONFIRM_WINDOW_MIN: z.number({ coerce: true }).min(0).default(30),
  /** How long credits must keep reading low before the email goes out, so a single misread cannot send one. */
  CREDITS_LOW_CONFIRM_WINDOW_MIN: z.number({ coerce: true }).min(0).default(30),
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
  MASTER_WALLET_AKT_RESERVE: z.number({ coerce: true }).int().nonnegative().default(2_000_000_000),
  MASTER_WALLET_MAX_MINT_UAKT: z.number({ coerce: true }).int().nonnegative().default(5_000_000_000),
  TX_SIGNER_BASE_URL: z.string(),
  TX_SIGNER_API_KEY: z.string().min(32)
});

export type BillingConfig = z.infer<typeof envSchema>;
