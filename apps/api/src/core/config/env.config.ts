import { netConfig } from "@akashnetwork/net";
import { z } from "zod";

export const envSchema = z
  .object({
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
    STD_OUT_LOG_FORMAT: z.enum(["json", "pretty"]).optional().default("json"),
    SQL_LOG_FORMAT: z.enum(["raw", "pretty"]).optional().default("raw"),
    FLUENTD_TAG: z.string().optional().default("pino"),
    FLUENTD_HOST: z.string().optional(),
    FLUENTD_PORT: z.number({ coerce: true }).optional().default(24224),
    NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
    POSTGRES_DB_URI: z.string(),
    POSTGRES_BACKGROUND_JOBS_SCHEMA: z.string().optional().default("pgboss"),
    POSTGRES_MAX_CONNECTIONS: z.number({ coerce: true }).optional().default(20),
    DRIZZLE_MIGRATIONS_FOLDER: z.string().optional().default("./drizzle"),
    DEPLOYMENT_ENV: z.string().optional().default("production"),
    NETWORK: z.enum(["mainnet", "testnet", "sandbox"]).default("mainnet"),
    AMPLITUDE_API_KEY: z.string(),
    UNLEASH_SERVER_API_URL: z.string().optional(),
    UNLEASH_SERVER_API_TOKEN: z.string().optional(),
    UNLEASH_APP_NAME: z.string().optional().default("console-api"),
    FEATURE_FLAGS_ENABLE_ALL: z
      .string()
      .default("false")
      .transform(value => value === "true"),
    FEATURE_FLAGS_EXTERNAL_TX_SIGNER_DISABLED: z
      .string()
      .default("false")
      .transform(value => value === "true"),
    REST_API_NODE_URL: z
      .string()
      .url()
      .default(() => netConfig.getBaseAPIUrl(process.env.NETWORK || "mainnet")),
    PORT: z.number({ coerce: true }).optional().default(3080),
    NODE_API_BASE_PATH: z.string().optional().default("https://raw.githubusercontent.com/akash-network"),
    CORS_WEBSITE_URLS: z.string().default(["http://localhost:3000", "http://localhost:3001"].join(",")),
    SECRET_TOKEN: z.string().optional(), // private api token
    SERVER_ORIGIN: z.string().default("http://localhost:3080")
  })
  .superRefine((value, ctx) => {
    if (!value.FEATURE_FLAGS_ENABLE_ALL && (!value.UNLEASH_SERVER_API_URL || !value.UNLEASH_SERVER_API_TOKEN)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "UNLEASH_SERVER_API_URL and UNLEASH_SERVER_API_TOKEN are required when FEATURE_FLAGS_ENABLE_ALL is false"
      });
    }
  });

export type CoreConfig = z.infer<typeof envSchema>;
