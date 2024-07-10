import { z } from "zod";

const envSchema = z.object({
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  // TODO: make required once billing is in prod
  POSTGRES_DB_URI: z.string().optional()
});

export const envConfig = envSchema.parse(process.env);
