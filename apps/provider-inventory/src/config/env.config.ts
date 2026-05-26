import { z } from "zod";

export const envSchema = z.object({
  PROVIDER_INVENTORY_POSTGRES_URL: z.string(),
  POSTGRES_MAX_CONNECTIONS: z.number({ coerce: true }).int().min(1).default(20),
  POSTGRES_CONNECT_TIMEOUT: z.number({ coerce: true }).int().nonnegative().default(3),
  POSTGRES_IDLE_TIMEOUT: z.number({ coerce: true }).int().nonnegative().default(120),
  POSTGRES_MAX_LIFETIME: z.number({ coerce: true }).int().nonnegative().default(1800),
  DRIZZLE_MIGRATIONS_FOLDER: z.string().default("./drizzle"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
  SQL_LOG_FORMAT: z.enum(["raw", "pretty"]).default("raw"),
  PORT: z.number({ coerce: true }).default(3092),
  DISCOVERY_INTERVAL_MS: z.number({ coerce: true }).default(10 * 60 * 1000), // 10 minutes
  STREAM_RECONNECT_INITIAL_DELAY_MS: z.number({ coerce: true }).default(1_000),
  STREAM_RECONNECT_MAX_DELAY_MS: z.number({ coerce: true }).default(5 * 60 * 1000), // 5 minutes
  STREAM_FIRST_MESSAGE_TIMEOUT_MS: z.number({ coerce: true }).default(10_000),
  REST_API_NODE_URL: z.string().url()
});

export type EnvConfig = z.infer<typeof envSchema>;
