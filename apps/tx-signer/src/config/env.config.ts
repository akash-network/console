import { z } from "zod";

export const envSchema = z.object({
  FUNDING_WALLET_MNEMONIC_V2: z.string(),
  DERIVATION_WALLET_MNEMONIC_V2: z.string(),
  RPC_NODE_ENDPOINT: z.string(),
  GAS_SAFETY_MULTIPLIER: z.number({ coerce: true }).default(1.8),
  AVERAGE_GAS_PRICE: z.number({ coerce: true }).default(0.025),
  WALLET_BATCHING_INTERVAL_MS: z.number({ coerce: true }).optional().default(1000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  PORT: z.number({ coerce: true }).optional().default(3091)
});

export type EnvConfig = z.infer<typeof envSchema>;
