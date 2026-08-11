import { z } from "zod";

/** Treats an empty string as absent so `VAR=` lines in env files don't fail coerced-number validation. */
const emptyStringAsUndefined = (value: unknown) => (value === "" ? undefined : value);

export const envSchema = z.object({
  INDEXER_ROLE: z.enum(["sync", "backfill", "api", "jobs"]).default("sync"),
  NETWORK: z.enum(["mainnet", "sandbox", "testnet"]).default("sandbox"),
  POSTGRES_DB_URI: z.string(),
  /** Comma-separated RPC endpoints. Defaults to the network's public endpoints from @akashnetwork/net. */
  RPC_NODE_ENDPOINTS: z.string().optional(),
  RPC_TIMEOUT_MS: z.number({ coerce: true }).int().positive().default(15_000),
  RPC_NODE_COOLDOWN_MS: z.number({ coerce: true }).int().positive().default(30_000),
  /** First height to sync when the database has no checkpoint yet. Defaults to the current chain tip. */
  SYNC_START_HEIGHT: z.preprocess(emptyStringAsUndefined, z.number({ coerce: true }).int().positive().optional()),
  SYNC_POLL_INTERVAL_MS: z.number({ coerce: true }).int().positive().default(3_000),
  /** Decoded message bodies above this serialized size are stored as null to keep pathological messages out of Postgres. */
  MESSAGE_BODY_MAX_BYTES: z.number({ coerce: true }).int().positive().default(65_536),
  DRIZZLE_MIGRATIONS_FOLDER: z.string().default("./drizzle"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  PORT: z.number({ coerce: true }).int().min(1).max(65_535).optional().default(3092)
});

export type EnvConfig = z.infer<typeof envSchema>;
