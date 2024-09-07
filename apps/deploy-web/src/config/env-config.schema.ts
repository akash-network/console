import { z } from "zod";

const networkId = z.enum(["mainnet", "sandbox", "testnet"]);
const coercedBoolean = () => z.enum(["true", "false"]).transform(val => val === "true");

export const browserEnvSchema = z.object({
  NEXT_PUBLIC_MASTER_WALLET_ADDRESS: z.string(),
  NEXT_PUBLIC_BILLING_ENABLED: coercedBoolean().optional().default("false"),
  NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_MANAGED_WALLET_DENOM: z.enum(["uakt", "usdc"]).optional().default("usdc"),
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_STATS_APP_URL: z.string().url(),
  NEXT_PUBLIC_PROVIDER_PROXY_URL: z.string().url(),
  NEXT_PUBLIC_PROVIDER_PROXY_URL_WS: z.string().url(),
  NEXT_PUBLIC_NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT: z.number({ coerce: true }).optional().default(500000),
  NEXT_PUBLIC_BASE_API_MAINNET_URL: z.string().url(),
  NEXT_PUBLIC_BASE_API_TESTNET_URL: z.string().url(),
  NEXT_PUBLIC_BASE_API_SANDBOX_URL: z.string().url(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional()
});

export const serverEnvSchema = browserEnvSchema.extend({
  MAINTENANCE_MODE: coercedBoolean().optional().default("false"),
  AUTH0_SECRET: z.string(),
  AUTH0_BASE_URL: z.string().url(),
  AUTH0_ISSUER_BASE_URL: z.string().url(),
  AUTH0_CLIENT_ID: z.string(),
  AUTH0_CLIENT_SECRET: z.string(),
  AUTH0_AUDIENCE: z.string(),
  AUTH0_SCOPE: z.string()
});

export type BrowserEnvConfig = z.infer<typeof browserEnvSchema>;
export type ServerEnvConfig = z.infer<typeof serverEnvSchema>;

export const castToValidatedDuringBuild = (config: Record<string, unknown>) => config as unknown as BrowserEnvConfig;
export const castToValidatedOnStartup = (config: Record<string, unknown>) => config as unknown as ServerEnvConfig;
