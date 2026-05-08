import { z } from "zod";

export const envSchema = z.object({
  PROVIDER_INVENTORY_POSTGRES_URL: z.string(),
  DRIZZLE_MIGRATIONS_FOLDER: z.string().optional().default("./drizzle"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  PORT: z.number({ coerce: true }).optional().default(3092),
  DISCOVERY_INTERVAL_MS: z.number({ coerce: true }).optional().default(600_000)
});

export type EnvConfig = z.infer<typeof envSchema>;
