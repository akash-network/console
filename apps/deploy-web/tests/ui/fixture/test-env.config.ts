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
  })
});

export const testEnvConfig = testEnvSchema.parse({
  BASE_URL: process.env.BASE_URL,
  TEST_WALLET_MNEMONIC: process.env.TEST_WALLET_MNEMONIC,
  USER_DATA_DIR: process.env.USER_DATA_DIR,
  E2E_TESTING_CLIENT_TOKEN: process.env.E2E_TESTING_CLIENT_TOKEN
});

export const PROVIDERS_WHITELIST = {
  mainnet: ["provider.hurricane.akash.pub", "provider.europlots.com"],
  sandbox: ["provider.provider-02.sandbox-01.aksh.pw", "provider.europlots-sandbox.com"],
  testnet: []
} satisfies Record<"mainnet" | "sandbox" | "testnet", string[]>;
