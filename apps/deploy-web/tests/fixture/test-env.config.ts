import { z } from "zod";

export const testEnvSchema = z.object({
  BASE_URL: z.string().default("http://localhost:3000"),
  TEST_WALLET_MNEMONIC: z.string(),
  UI_CONFIG_SIGNATURE_PRIVATE_KEY: z.string().optional()
});

export const testEnvConfig = testEnvSchema.parse({
  BASE_URL: process.env.BASE_URL,
  TEST_WALLET_MNEMONIC: process.env.TEST_WALLET_MNEMONIC,
  UI_CONFIG_SIGNATURE_PRIVATE_KEY: process.env.UI_CONFIG_SIGNATURE_PRIVATE_KEY
});
