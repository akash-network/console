import { z } from "zod";

export const env = z
  .object({
    AKASHLYTICS_CORS_WEBSITE_URLS: z.string().optional(),
    NODE_ENV: z.string().optional(),
    HEALTHCHECKS_ENABLED: z.string().optional(),
    AKASH_DATABASE_CS: z.string().optional(),
    AKASH_TESTNET_DATABASE_CS: z.string().optional(),
    AKASH_SANDBOX_DATABASE_CS: z.string().optional(),
    USER_DATABASE_CS: z.string().optional(),
    NETWORK: z.string().default("mainnet"),
    REST_API_NODE_URL: z.string().optional(),
    SERVER_ORIGIN: z.string().optional().default("http://localhost:3080"),
    AKASHLYTICS_GITHUB_PAT: z.string().optional(),
    AUTH0_JWKS_URI: z.string().optional(),
    AUTH0_AUDIENCE: z.string().optional(),
    AUTH0_ISSUER: z.string().optional(),
    WEBSITE_URL: z.string().optional(),
    SECRET_TOKEN: z.string().optional(),
    PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: z
      .number()
      .optional()
      .default(3 * 60),
    NODE_API_BASE_PATH: z.string().optional().default("https://raw.githubusercontent.com/akash-network")
  })
  .parse(process.env);
