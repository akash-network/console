import { z } from "zod";

export const networkId = z.enum(["mainnet", "sandbox", "testnet"]);

export const browserEnvSchema = z.object({
  VITE_DEFAULT_NETWORK_ID: networkId.optional().default("mainnet"),
  VITE_API_BASE_URL: z.string().url(),
  VITE_NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  VITE_BASE_API_TESTNET_URL: z.string().url(),
  VITE_BASE_API_SANDBOX_URL: z.string().url(),
  VITE_BASE_API_MAINNET_URL: z.string().url(),
  VITE_LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  VITE_UNLEASH_ENABLE_ALL: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform(value => value === "true"),
  VITE_SENTRY_DSN: z.string().optional(),
  VITE_SENTRY_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform(value => value === "true"),
  VITE_GA_MEASUREMENT_ID: z.string().optional()
});

export type BrowserEnvConfig = z.infer<typeof browserEnvSchema>;

export const validateStaticEnvVars = (config: Record<string, unknown>) => browserEnvSchema.parse(config);
