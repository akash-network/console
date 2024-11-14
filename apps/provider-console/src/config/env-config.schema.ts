import { z } from "zod";

const networkId = z.enum(["mainnet", "sandbox", "testnet"]);

export const browserEnvSchema = z.object({
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  NEXT_PUBLIC_CONSOLE_API_MAINNET_URL: z.string().url(),
  NEXT_PUBLIC_BASE_SECURITY_URL: z.string().url(),
  NEXT_PUBLIC_MAINNET_RPC_URL: z.string().url(),
  NEXT_PUBLIC_MAINNET_API_URL: z.string().url()
});

export type BrowserEnvConfig = z.infer<typeof browserEnvSchema>;
export const validateStaticEnvVars = (config: Record<string, unknown>) => browserEnvSchema.parse(config); 