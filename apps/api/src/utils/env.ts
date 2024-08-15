import { z } from "zod";

export const env = z
  .object({
    AKASHLYTICS_CORS_WEBSITE_URLS: z.string().optional(),
    NODE_ENV: z.string().optional(),
    HealthchecksEnabled: z.string().optional(),
    AkashDatabaseCS: z.string().optional(),
    AkashTestnetDatabaseCS: z.string().optional(),
    AkashSandboxDatabaseCS: z.string().optional(),
    UserDatabaseCS: z.string().optional(),
    NETWORK: z.string().default("mainnet"),
    RestApiNodeUrl: z.string().optional(),
    ServerOrigin: z.string().optional().default("http://localhost:3080"),
    AkashlyticsGithubPAT: z.string().optional(),
    Auth0JWKSUri: z.string().optional(),
    Auth0Audience: z.string().optional(),
    Auth0Issuer: z.string().optional(),
    WebsiteUrl: z.string().optional(),
    SecretToken: z.string().optional(),
    ProviderUptimeGracePeriodMinutes: z
      .number()
      .optional()
      .default(3 * 60),
    NODE_API_BASE_PATH: z.string().optional().default("https://raw.githubusercontent.com/akash-network")
  })
  .parse(process.env);
