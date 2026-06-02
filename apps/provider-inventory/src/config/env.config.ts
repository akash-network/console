import { z } from "zod";

export const envSchema = z.object({
  PROVIDER_INVENTORY_POSTGRES_URL: z.string(),
  POSTGRES_MAX_CONNECTIONS: z.number({ coerce: true }).int().min(1).default(20),
  POSTGRES_CONNECT_TIMEOUT: z.number({ coerce: true }).int().nonnegative().default(30),
  POSTGRES_IDLE_TIMEOUT: z.number({ coerce: true }).int().nonnegative().default(120),
  POSTGRES_MAX_LIFETIME: z.number({ coerce: true }).int().nonnegative().default(1800),
  DRIZZLE_MIGRATIONS_FOLDER: z.string().default("./drizzle"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
  SQL_LOG_FORMAT: z.enum(["raw", "pretty"]).default("raw"),
  PORT: z.number({ coerce: true }).default(3092),
  DISCOVERY_INTERVAL_MS: z.number({ coerce: true }).default(10 * 60 * 1000),
  MAX_CONCURRENT_STREAM_CONNECTIONS: z.number({ coerce: true }).positive().default(100),
  STREAM_RECONNECT_INITIAL_DELAY_MS: z.number({ coerce: true }).default(60_000),
  STREAM_RECONNECT_MAX_DELAY_MS: z.number({ coerce: true }).default(5 * 60 * 1000),
  STREAM_FIRST_MESSAGE_TIMEOUT_MS: z.number({ coerce: true }).default(10_000),
  STREAM_UPDATE_THROTTLE_MS: z.number({ coerce: true }).nonnegative().default(1000),
  REST_API_NODE_URL: z.string().url()
});

export type EnvConfig = z.infer<typeof envSchema>;
