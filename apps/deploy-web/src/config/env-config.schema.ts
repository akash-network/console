import { z } from "zod";

const networkId = z.enum(["mainnet", "sandbox", "testnet"]);
const coercedBoolean = () => z.enum(["true", "false"]).transform(val => val === "true");

export const browserEnvSchema = z.object({
  NEXT_PUBLIC_MASTER_WALLET_ADDRESS: z.string(),
  NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS: z.string(),
  NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS: z.string(),
  NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_MANAGED_WALLET_DENOM: z.enum(["uakt", "usdc"]).optional().default("usdc"),
  NEXT_PUBLIC_API_BASE_URL: z.string(),
  NEXT_PUBLIC_STATS_APP_URL: z.string().url(),
  NEXT_PUBLIC_PROVIDER_PROXY_URL: z.string(),
  NEXT_PUBLIC_NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT: z.number({ coerce: true }).optional().default(500000),
  NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS: z.number({ coerce: true }).optional().default(24),
  NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT: z.number({ coerce: true }).optional().default(100),
  NEXT_PUBLIC_TRIAL_DURATION_DAYS: z.number({ coerce: true }).optional().default(30),
  NEXT_PUBLIC_BASE_API_MAINNET_URL: z.string(),
  NEXT_PUBLIC_BASE_API_TESTNET_URL: z.string(),
  NEXT_PUBLIC_BASE_API_SANDBOX_URL: z.string(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string(),
  NEXT_PUBLIC_GA_ENABLED: coercedBoolean(),
  NEXT_PUBLIC_AMPLITUDE_ENABLED: coercedBoolean(),
  NEXT_PUBLIC_AMPLITUDE_API_KEY: z.string(),
  NEXT_PUBLIC_AMPLITUDE_PROXY_URL: z.string().optional().describe("A url to proxy Amplitude events to via nextjs rewrite config to avoid blockers"),
  NEXT_PUBLIC_REDIRECT_URI: z.string().url(),
  NEXT_PUBLIC_GITHUB_APP_INSTALLATION_URL: z.string().url(),
  NEXT_PUBLIC_BITBUCKET_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_GITLAB_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_GITHUB_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_CI_CD_IMAGE_NAME: z.string(),
  NEXT_PUBLIC_TURNSTILE_ENABLED: coercedBoolean(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string(),
  NEXT_PUBLIC_TRACKING_ENABLED: coercedBoolean().optional().default("false"),
  NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED: coercedBoolean().optional().default("false"),
  NEXT_PUBLIC_UNLEASH_ENABLE_ALL: coercedBoolean().optional().default("false"),
  NEXT_PUBLIC_GTM_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_BASE_TEMPLATES_URL: z.string().url()
});

export const serverEnvSchema = browserEnvSchema.extend({
  MAINTENANCE_MODE: coercedBoolean().optional().default("false"),
  AUTH0_SECRET: z.string(),
  AUTH0_BASE_URL: z.string().url(),
  AUTH0_ISSUER_BASE_URL: z.string().url(),
  AUTH0_CLIENT_ID: z.string(),
  AUTH0_CLIENT_SECRET: z.string(),
  AUTH0_AUDIENCE: z.string(),
  AUTH0_SCOPE: z.string(),
  AUTH0_LOCAL_ENABLED: coercedBoolean().optional(),
  AUTH0_REDIRECT_BASE_URL: z.string().url().optional(),
  BASE_API_MAINNET_URL: z.string().url(),
  BASE_API_TESTNET_URL: z.string().url(),
  BASE_API_SANDBOX_URL: z.string().url(),
  GITHUB_CLIENT_SECRET: z.string(),
  BITBUCKET_CLIENT_SECRET: z.string(),
  GITLAB_CLIENT_SECRET: z.string(),
  NEXT_PUBLIC_CI_CD_IMAGE_NAME: z.string(),
  NEXT_PUBLIC_PROVIDER_PROXY_URL: z.string(),
  NEXT_PUBLIC_UNLEASH_ENABLE_ALL: coercedBoolean().optional().default("false"),
  NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID: networkId.optional().default("mainnet"),
  NEXT_PUBLIC_DEFAULT_NETWORK_ID: networkId.optional().default("mainnet"),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  TURNSTILE_SECRET_KEY: z.string(),
  /**
   * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/#test-secret-keys
   */
  TURNSTILE_BYPASS_SECRET_KEY: z.string().default("1x0000000000000000000000000000000AA"),
  E2E_TESTING_CLIENT_TOKEN: z.string({
    required_error: "This token is used to adjust configuration of the app for e2e testing. Can be any random string."
  })
});

export type BrowserEnvConfig = z.infer<typeof browserEnvSchema>;
export type ServerEnvConfig = z.infer<typeof serverEnvSchema>;

export const validateStaticEnvVars = (config: Record<string, unknown>) => browserEnvSchema.parse(config);
export const validateRuntimeEnvVars = (config: Record<string, unknown>) => {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    console.log("Skipping validation of serverEnvConfig during build");
    return config as ServerEnvConfig;
  } else {
    return serverEnvSchema.parse(config);
  }
};
