import { LoggerService } from "@akashnetwork/logging";
import { z } from "zod";

export const networkId = z.enum(["mainnet", "sandbox", "testnet"]);
const coercedBoolean = () => z.enum(["true", "false"]).transform(val => val === "true");
const envLogger = LoggerService.forContext("apps/stats-web/src/config/env-config.schema.ts");

export const browserEnvSchema = z.object({
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  NEXT_PUBLIC_BASE_API_TESTNET_URL: z.string().url(),
  NEXT_PUBLIC_BASE_API_SANDBOX_URL: z.string().url(),
  NEXT_PUBLIC_BASE_API_MAINNET_URL: z.string().url(),
  NEXT_PUBLIC_LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info")
});

export const serverEnvSchema = browserEnvSchema.extend({
  MAINTENANCE_MODE: coercedBoolean().optional().default("false"),
  BASE_API_MAINNET_URL: z.string().url(),
  BASE_API_TESTNET_URL: z.string().url(),
  BASE_API_SANDBOX_URL: z.string().url()
});

export type BrowserEnvConfig = z.infer<typeof browserEnvSchema>;
export type ServerEnvConfig = z.infer<typeof serverEnvSchema>;

export const validateStaticEnvVars = (config: Record<string, unknown>) => browserEnvSchema.parse(config);
export const validateRuntimeEnvVars = (config: Record<string, unknown>) => {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    envLogger.debug("Skipping validation of serverEnvConfig during build");
    return config as ServerEnvConfig;
  } else {
    return serverEnvSchema.parse(config);
  }
};
