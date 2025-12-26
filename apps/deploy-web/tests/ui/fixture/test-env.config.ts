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
  USER_DATA_DIR: z.string().default(path.join(tmpdir(), "akash-console-web-ui-tests", crypto.randomUUID()))
});

export const testEnvConfig = testEnvSchema.parse({
  BASE_URL: process.env.BASE_URL,
  TEST_WALLET_MNEMONIC: process.env.TEST_WALLET_MNEMONIC,
  USER_DATA_DIR: process.env.USER_DATA_DIR
});

export const PROVIDERS_WHITELIST = {
  mainnet: ["provider.hurricane.akash.pub", "provider.europlots.com"],
  sandbox: ["provider.provider-02.sandbox-01.aksh.pw", "provider.europlots-sandbox.com"],
  testnet: []
} satisfies Record<"mainnet" | "sandbox" | "testnet", string[]>;
