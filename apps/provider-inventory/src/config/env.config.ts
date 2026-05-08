import { z } from "zod";

export const envSchema = z.object({
  PROVIDER_INVENTORY_POSTGRES_URL: z.string(),
  DRIZZLE_MIGRATIONS_FOLDER: z.string().default("./drizzle"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).default("json"),
  PORT: z.number({ coerce: true }).default(3092),
  DISCOVERY_INTERVAL_MS: z.number({ coerce: true }).default(10 * 60 * 1000) // 10 minutes
});

export type EnvConfig = z.infer<typeof envSchema>;
