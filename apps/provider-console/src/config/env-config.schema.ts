import { z } from "zod";

const networkId = z.enum(["mainnet", "sandbox", "testnet"]);

export const browserEnvSchema = z.object({
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),

  // Network selection (set by GitHub Actions)
  NEXT_PUBLIC_SELECTED_NETWORK: networkId.optional().default("mainnet").describe("Must be one of: mainnet, sandbox, testnet"),

  // Generic network configuration (populated from chain-specific .env files)
  NEXT_PUBLIC_NETWORK_TITLE: z.string(),
  NEXT_PUBLIC_CHAIN_ID: z.string(),
  NEXT_PUBLIC_CHAIN_REGISTRY_NAME: z.string(),
  NEXT_PUBLIC_NETWORK_TYPE: z.string(),
  NEXT_PUBLIC_RPC_ENDPOINT: z.string().url(),
  NEXT_PUBLIC_API_ENDPOINT: z.string().url(),
  NEXT_PUBLIC_CONSOLE_API_URL: z.string().url(),
  NEXT_PUBLIC_SECURITY_URL: z.string().url(),
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_URL: z.string().url(),

  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional()
});

export type BrowserEnvConfig = z.infer<typeof browserEnvSchema>;
export const validateStaticEnvVars = (config: Record<string, unknown>) => browserEnvSchema.parse(config);
