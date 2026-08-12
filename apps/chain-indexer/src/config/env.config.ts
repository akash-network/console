import { z } from "zod";

/** Treats an empty string as absent so `VAR=` lines in env files don't fail coerced-number validation. */
const emptyStringAsUndefined = (value: unknown) => (value === "" ? undefined : value);

const rawEnvSchema = z.object({
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
  /** First height of the backfill range (inclusive). Required when INDEXER_ROLE is "backfill". */
  BACKFILL_FROM_HEIGHT: z.preprocess(emptyStringAsUndefined, z.number({ coerce: true }).int().positive().optional()),
  /** Last height of the backfill range (inclusive). Required when INDEXER_ROLE is "backfill". */
  BACKFILL_TO_HEIGHT: z.preprocess(emptyStringAsUndefined, z.number({ coerce: true }).int().positive().optional()),
  /** How many blocks the backfill fetches from RPC in parallel. */
  BACKFILL_CONCURRENCY: z.number({ coerce: true }).int().min(1).max(64).default(10),
  /** How many blocks the backfill commits per Postgres transaction. */
  BACKFILL_BATCH_SIZE: z.number({ coerce: true }).int().min(1).max(1_000).default(200),
  /** GCS bucket for the raw block archive. Unset disables archiving entirely (sync skips appends, backfill reads straight from RPC). */
  ARCHIVE_BUCKET: z.preprocess(emptyStringAsUndefined, z.string().optional()),
  /** Decoded message bodies above this serialized size are stored as null to keep pathological messages out of Postgres. */
  MESSAGE_BODY_MAX_BYTES: z.number({ coerce: true }).int().positive().default(65_536),
  DRIZZLE_MIGRATIONS_FOLDER: z.string().default("./drizzle"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  PORT: z.number({ coerce: true }).int().min(1).max(65_535).optional().default(3092)
});

export const envSchema = rawEnvSchema.superRefine((env, ctx) => {
  if (env.INDEXER_ROLE !== "backfill") {
    return;
  }

  (["BACKFILL_FROM_HEIGHT", "BACKFILL_TO_HEIGHT"] as const).forEach(key => {
    if (env[key] === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Required when INDEXER_ROLE is "backfill"' });
    }
  });

  if (env.BACKFILL_FROM_HEIGHT !== undefined && env.BACKFILL_TO_HEIGHT !== undefined && env.BACKFILL_FROM_HEIGHT > env.BACKFILL_TO_HEIGHT) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["BACKFILL_FROM_HEIGHT"], message: "BACKFILL_FROM_HEIGHT must be <= BACKFILL_TO_HEIGHT" });
  }
});

export type EnvConfig = z.infer<typeof envSchema>;
