import { z } from "zod";

const envSchema = z.object({
  MASTER_WALLET_MNEMONIC: z.string(),
  NETWORK: z.enum(["mainnet", "testnet", "sandbox"]),
  RPC_NODE_ENDPOINT: z.string(),
  TRIAL_ALLOWANCE_EXPIRATION_DAYS: z.number({ coerce: true }).default(14),
  TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: z.number({ coerce: true }),
  TRIAL_FEES_ALLOWANCE_AMOUNT: z.number({ coerce: true }),
  TRIAL_ALLOWANCE_DENOM: z.string(),
  GAS_SAFETY_MULTIPLIER: z.number({ coerce: true }).default(1.5)
});

export const envConfig = envSchema.parse(process.env);
