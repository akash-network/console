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
  /**
   * Reconciles the validator set, delegations and unbonding against the chain once sync catches up to the tip
   * and this many blocks have passed since the last snapshot. Delegation shares can't be derived exactly from
   * messages, so this authoritative snapshot is what keeps them matching chain queries.
   */
  STAKING_SNAPSHOT_INTERVAL_BLOCKS: z.number({ coerce: true }).int().positive().default(1_000),
  /** Enables the periodic staking snapshot. Off leaves validators at their genesis and message-derived state. */
  STAKING_SNAPSHOT_ENABLED: z.preprocess(emptyStringAsUndefined, z.enum(["true", "false"]).default("true")).transform(value => value === "true"),
  /**
   * Enables the one-time genesis import (accounts, balances, validators, delegations) before the first block.
   * When on, a fresh sync must start at the network's genesis height or it is rejected as a mid-chain start.
   * Off preserves plain block/tx/message tailing from any height. Enum-transform rather than z.coerce.boolean(),
   * which treats the string "false" as true.
   */
  GENESIS_IMPORT: z.preprocess(emptyStringAsUndefined, z.enum(["true", "false"]).default("false")).transform(value => value === "true"),
  /**
   * Path to a genesis JSON file. When set, the import reads this instead of `/genesis_chunked`, which is
   * the practical way to seed a large mainnet genesis. The file's chain_id must still match the RPC node.
   */
  GENESIS_FILE: z.preprocess(emptyStringAsUndefined, z.string().optional()),
  /** First height of the backfill range (inclusive). Required when INDEXER_ROLE is "backfill". */
  BACKFILL_FROM_HEIGHT: z.preprocess(emptyStringAsUndefined, z.number({ coerce: true }).int().positive().optional()),
  /** Last height of the backfill range (inclusive). Required when INDEXER_ROLE is "backfill". */
  BACKFILL_TO_HEIGHT: z.preprocess(emptyStringAsUndefined, z.number({ coerce: true }).int().positive().optional()),
  /** How many blocks the backfill fetches from RPC in parallel. */
  BACKFILL_CONCURRENCY: z.number({ coerce: true }).int().min(1).max(64).default(10),
  /** How many blocks the backfill commits per Postgres transaction. */
  BACKFILL_BATCH_SIZE: z.number({ coerce: true }).int().min(1).max(1_000).default(200),
  /**
   * Replays the range from BACKFILL_FROM_HEIGHT even when its checkpoint says complete. A replay
   * fills message bodies that were null (e.g. dead-lettered types registered since) and clears
   * healed dead letters; already-decoded rows are left untouched.
   */
  BACKFILL_REPLAY: z.preprocess(emptyStringAsUndefined, z.enum(["true", "false"]).default("false")).transform(value => value === "true"),
  /** GCS bucket for the raw block archive. Unset disables archiving entirely (sync skips appends, backfill reads straight from RPC). */
  ARCHIVE_BUCKET: z.preprocess(emptyStringAsUndefined, z.string().optional()),
  /**
   * Overrides the GCS API endpoint for local emulators (e.g. fake-gcs-server). The SDK's own
   * STORAGE_EMULATOR_HOST is not honored here: it switches the SDK to unprefixed request paths
   * that fake-gcs-server rejects, while the apiEndpoint option keeps standard JSON API paths.
   */
  ARCHIVE_STORAGE_API_ENDPOINT: z.preprocess(emptyStringAsUndefined, z.string().url().optional()),
  /** Decoded message bodies above this serialized size are stored as null to keep pathological messages out of Postgres. */
  MESSAGE_BODY_MAX_BYTES: z.number({ coerce: true }).int().positive().default(65_536),
  /** How many of the highest-balance accounts `npm run reconcile` checks against the chain. Unset defers to the service default. */
  RECONCILE_SAMPLE_SIZE: z.preprocess(emptyStringAsUndefined, z.number({ coerce: true }).int().positive().optional()),
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
