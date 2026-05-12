import { z } from "zod";

export const envSchema = z.object({
  PROVIDER_INVENTORY_POSTGRES_URL: z.string(),
  DRIZZLE_MIGRATIONS_FOLDER: z.string().default("./drizzle"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
  PORT: z.number({ coerce: true }).default(3092),
  DISCOVERY_INTERVAL_MS: z.number({ coerce: true }).default(10 * 60 * 1000), // 10 minutes
  STREAM_RECONNECT_INITIAL_DELAY_MS: z.number({ coerce: true }).default(1_000),
  STREAM_RECONNECT_MAX_DELAY_MS: z.number({ coerce: true }).default(5 * 60 * 1000), // 5 minutes
  STREAM_FIRST_MESSAGE_TIMEOUT_MS: z.number({ coerce: true }).default(10_000),
  AUDITOR_ADDRESS: z.string().default("akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"),
  REST_API_NODE_URL: z.string().url()
});

export type EnvConfig = z.infer<typeof envSchema>;
