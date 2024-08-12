import { z } from "zod";

const envSchema = z.object({
  MASTER_WALLET_MNEMONIC: z.string(),
  NETWORK: z.enum(["mainnet", "testnet", "sandbox"]),
  RPC_NODE_ENDPOINT: z.string(),
  TRIAL_ALLOWANCE_EXPIRATION_DAYS: z.number({ coerce: true }).default(14),
  TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: z.number({ coerce: true }),
  TRIAL_FEES_ALLOWANCE_AMOUNT: z.number({ coerce: true }),
  DEPLOYMENT_GRANT_DENOM: z.string(),
  GAS_SAFETY_MULTIPLIER: z.number({ coerce: true }).default(1.5),
  FEE_ALLOWANCE_REFILL_THRESHOLD: z.number({ coerce: true }),
  DEPLOYMENT_ALLOWANCE_REFILL_THRESHOLD: z.number({ coerce: true }),
  FEE_ALLOWANCE_REFILL_AMOUNT: z.number({ coerce: true }),
  DEPLOYMENT_ALLOWANCE_REFILL_AMOUNT: z.number({ coerce: true }),
  ALLOWANCE_REFILL_BATCH_SIZE: z.number({ coerce: true }).default(10),
  MASTER_WALLET_BATCHING_INTERVAL_MS: z.number().optional().default(1000)
});

export const envConfig = envSchema.parse(process.env);
