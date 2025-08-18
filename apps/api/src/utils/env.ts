import { z } from "zod";

export const env = z
  .object({
    CORS_WEBSITE_URLS: z.string().optional(),
    NODE_ENV: z.string().optional(),
    HEALTHCHECKS_ENABLED: z.string().optional(),
    CHAIN_INDEXER_POSTGRES_DB_URI: z.string(),
    NETWORK: z.string().default("mainnet"),
    PROXY_API_URL: z.string().optional().default("https://rpc.akt.dev/rest"),
    PROXY_RPC_URL: z.string().optional().default("https://rpc.akt.dev/rpc"),
    SERVER_ORIGIN: z.string().optional().default("http://localhost:3080"),
    GITHUB_PAT: z.string().optional(),
    AUTH0_JWKS_URI: z.string().optional(),
    AUTH0_AUDIENCE: z.string().optional(),
    AUTH0_ISSUER: z.string().optional(),
    WEBSITE_URL: z.string().optional(),
    SECRET_TOKEN: z.string().optional(),
    PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: z
      .number()
      .optional()
      .default(3 * 60),
    NODE_API_BASE_PATH: z.string().optional().default("https://raw.githubusercontent.com/akash-network"),
    GPU_BOT_WALLET_MNEMONIC: z.string().optional(),
    PRICING_BOT_ADDRESS: z.string().optional().default("akash1pas6v0905jgyznpvnjhg7tsthuyqek60gkz7uf")
  })
  .parse(process.env);
