import { z } from "zod";

export const envSchema = z.object({
  FUNDING_WALLET_MNEMONIC_V2: z.string(),
  DERIVATION_WALLET_MNEMONIC_V2: z.string(),
  RPC_NODE_ENDPOINT: z.string(),
  GAS_DEFAULT_MULTIPLIER: z.number({ coerce: true }).gt(1).default(1.4),
  // When a tx still lands out of gas, it is re-signed with gasLimit = on-chain gasUsed × this multiplier and rebroadcast.
  // gasUsed is the actual consumption measured on-chain, so a modest multiplier covers the extra settlement gas that
  // accrues between the failed attempt and the retry's inclusion height.
  GAS_RECOVERY_MULTIPLIER: z.number({ coerce: true }).gt(1).default(1.3),
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
