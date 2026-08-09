import { tmpdir } from "os";
import path from "path";
import { z } from "zod";

export const testEnvSchema = z.object({
  BASE_URL: z
    .string()
    .default("http://localhost:3000")
    .transform(url => url.replace(/\/+$/, "")),
  NETWORK_ID: z.enum(["mainnet", "sandbox", "testnet"]).default("sandbox"),
  USER_DATA_DIR: z.string().default(path.join(tmpdir(), "akash-console-web-ui-tests", crypto.randomUUID())),
  E2E_TESTING_CLIENT_TOKEN: z.string({
    required_error: "This token is used to adjust configuration of the app for e2e testing. Can be any random string but should match the one used by app."
  }),
  AUTH0_M2M_DOMAIN: z.string({ required_error: "Auth0 M2M domain for management API calls (e.g. 'your-tenant.us.auth0.com')" }).trim().min(1),
  AUTH0_M2M_CLIENT_ID: z.string({ required_error: "Auth0 M2M client ID for management API" }).trim().min(1),
  AUTH0_M2M_CLIENT_SECRET: z.string({ required_error: "Auth0 M2M client secret for management API" }).trim().min(1),
  E2E_INBOX_API_URL: z
    .string({ required_error: "Base URL of the e2e inbox worker that captures OTP emails (see tools/e2e-inbox-worker)" })
    .trim()
    .min(1)
    .transform(url => url.replace(/\/+$/, "")),
  E2E_INBOX_API_TOKEN: z.string({ required_error: "Bearer token for the e2e inbox worker HTTP endpoint" }).trim().min(1),
  E2E_INBOX_EMAIL_DOMAIN: z.string({ required_error: "Email domain routed to the e2e inbox worker (e.g. 'e2e.akash.network')" }).trim().min(1),
  TEST_USER_EMAIL: z.string().optional(),
  TEST_USER_PASSWORD: z.string().optional()
});

export const testEnvConfig = testEnvSchema.parse({
  BASE_URL: process.env.BASE_URL,
  NETWORK_ID: process.env.NETWORK_ID,
  USER_DATA_DIR: process.env.USER_DATA_DIR,
  E2E_TESTING_CLIENT_TOKEN: process.env.E2E_TESTING_CLIENT_TOKEN,
  AUTH0_M2M_DOMAIN: process.env.AUTH0_M2M_DOMAIN,
  AUTH0_M2M_CLIENT_ID: process.env.AUTH0_M2M_CLIENT_ID,
  AUTH0_M2M_CLIENT_SECRET: process.env.AUTH0_M2M_CLIENT_SECRET,
  E2E_INBOX_API_URL: process.env.E2E_INBOX_API_URL,
  E2E_INBOX_API_TOKEN: process.env.E2E_INBOX_API_TOKEN,
  E2E_INBOX_EMAIL_DOMAIN: process.env.E2E_INBOX_EMAIL_DOMAIN,
  TEST_USER_EMAIL: process.env.TEST_USER_EMAIL,
  TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD
});

export const PROVIDERS_WHITELIST = {
  mainnet: ["akash15tl6v6gd0nte0syyxnv57zmmspgju4c3xfmdhk", "akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc"],
  sandbox: ["akash1d4fletej4cwn9x8jzpzmnk6zkqeh90ejjskpmu", "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh"],
  testnet: []
} satisfies Record<"mainnet" | "sandbox" | "testnet", string[]>;
