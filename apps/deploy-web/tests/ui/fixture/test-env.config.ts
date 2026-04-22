import { tmpdir } from "os";
import path from "path";
import { z } from "zod";

export const testEnvSchema = z.object({
  BASE_URL: z
    .string()
    .default("http://localhost:3000")
    .transform(url => url.replace(/\/+$/, "")),
  TEST_WALLET_MNEMONIC: z.string(),
  NETWORK_ID: z.enum(["mainnet", "sandbox", "testnet"]).default("sandbox"),
  USER_DATA_DIR: z.string().default(path.join(tmpdir(), "akash-console-web-ui-tests", crypto.randomUUID())),
  E2E_TESTING_CLIENT_TOKEN: z.string({
    required_error: "This token is used to adjust configuration of the app for e2e testing. Can be any random string but should match the one used by app."
  }),
  AUTH0_M2M_DOMAIN: z.string({ required_error: "Auth0 M2M domain for management API calls (e.g. 'your-tenant.us.auth0.com')" }).trim().min(1),
  AUTH0_M2M_CLIENT_ID: z.string({ required_error: "Auth0 M2M client ID for management API" }).trim().min(1),
  AUTH0_M2M_CLIENT_SECRET: z.string({ required_error: "Auth0 M2M client secret for management API" }).trim().min(1),
  MAILSAC_API_KEY: z.string({ required_error: "Mailsac API key for email verification" }).trim().min(1),
  EMAIL_VERIFICATION_STRATEGY: z.enum(["mailsac-code", "auth0-ticket"]).default("mailsac-code"),
  TEST_USER_EMAIL: z.string().optional(),
  TEST_USER_PASSWORD: z.string().optional()
});

export const testEnvConfig = testEnvSchema.parse({
  BASE_URL: process.env.BASE_URL,
  TEST_WALLET_MNEMONIC: process.env.TEST_WALLET_MNEMONIC,
  USER_DATA_DIR: process.env.USER_DATA_DIR,
  E2E_TESTING_CLIENT_TOKEN: process.env.E2E_TESTING_CLIENT_TOKEN,
  AUTH0_M2M_DOMAIN: process.env.AUTH0_M2M_DOMAIN,
  AUTH0_M2M_CLIENT_ID: process.env.AUTH0_M2M_CLIENT_ID,
  AUTH0_M2M_CLIENT_SECRET: process.env.AUTH0_M2M_CLIENT_SECRET,
  MAILSAC_API_KEY: process.env.MAILSAC_API_KEY,
  EMAIL_VERIFICATION_STRATEGY: process.env.EMAIL_VERIFICATION_STRATEGY,
  TEST_USER_EMAIL: process.env.TEST_USER_EMAIL,
  TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD
});

export const PROVIDERS_WHITELIST = {
  mainnet: ["provider.hurricane.akash.pub", "provider.europlots.com"],
  sandbox: ["provider.provider-02.sandbox-01.aksh.pw", "provider.europlots-sandbox.com"],
  testnet: []
} satisfies Record<"mainnet" | "sandbox" | "testnet", string[]>;
