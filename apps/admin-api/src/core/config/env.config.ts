import { z } from "zod";

export const envSchema = z.object({
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  POSTGRES_DB_URI: z.string(),
  PORT: z.number({ coerce: true }).optional().default(3010),
  CORS_WEBSITE_URLS: z.string().default("http://localhost:3011"),
  AUTH0_JWKS_URI: z.string(),
  AUTH0_AUDIENCE: z.string().optional(),
  AUTH0_ISSUER: z.string(),
  ADMIN_ALLOWED_DOMAINS: z.string().default("akash.network"),
  ADMIN_WHITELIST_EMAILS: z.string().optional().default("")
});

export type AdminConfig = z.infer<typeof envSchema>;
