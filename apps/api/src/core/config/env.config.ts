import { z } from "zod";

const envSchema = z.object({
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  // TODO: make required once billing is in prod
  POSTGRES_DB_URI: z.string().optional(),
  POSTGRES_MAX_CONNECTIONS: z.number({ coerce: true }).optional().default(20)
});

export const envConfig = envSchema.parse(process.env);
