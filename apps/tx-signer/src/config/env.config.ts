import { z } from "zod";

export const envSchema = z.object({
  FUNDING_WALLET_MNEMONIC_V2: z.string(),
  DERIVATION_WALLET_MNEMONIC_V2: z.string(),
  RPC_NODE_ENDPOINT: z.string(),
  GAS_SAFETY_MULTIPLIER: z.number({ coerce: true }).default(1.8),
  AVERAGE_GAS_PRICE: z.number({ coerce: true }).default(0.025),
  // TTL for unordered transactions: the chain keeps the tx hash in memory for this window to reject duplicates,
  // so it must be long enough to guarantee block inclusion but short enough to bound mempool memory.
  UNORDERED_TX_TTL_MS: z.number({ coerce: true }).optional().default(18_000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  PORT: z.number({ coerce: true }).optional().default(3091)
});

export type EnvConfig = z.infer<typeof envSchema>;
