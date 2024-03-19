import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: ".env.local" });
dotenv.config();

export const env = z
  .object({
    SentryDSN: z.string().optional(),
    AKASHLYTICS_CORS_WEBSITE_URLS: z.string().optional(),
    NODE_ENV: z.string().optional(),
    SentryServerName: z.string().optional(),
    HealthchecksEnabled: z.string().optional(),
    AkashDatabaseCS: z.string().optional(),
    AkashTestnetDatabaseCS: z.string().optional(),
    AkashSandboxDatabaseCS: z.string().optional(),
    UserDatabaseCS: z.string().optional(),
    Network: z.string().default("mainnet"),
    RestApiNodeUrl: z.string().optional(),
    AkashlyticsGithubPAT: z.string().optional(),
    Auth0JWKSUri: z.string().optional(),
    Auth0Audience: z.string().optional(),
    Auth0Issuer: z.string().optional(),
    WebsiteUrl: z.string().optional(),
    SecretToken: z.string().optional(),
    NODE_API_BASE_PATH: z.string().optional().default("https://raw.githubusercontent.com/akash-network")
  })
  .parse(process.env);
