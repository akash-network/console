import { z } from "zod";

export const testEnvSchema = z.object({
  BASE_URL: z.string().default("http://localhost:3000"),
  TEST_WALLET_MNEMONIC: z.string()
});

export const testEnvConfig = testEnvSchema.parse({
  BASE_URL: process.env.BASE_URL,
  TEST_WALLET_MNEMONIC: process.env.TEST_WALLET_MNEMONIC
});
