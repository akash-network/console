import type { SupportedChainNetworks } from "@akashnetwork/net";
import { netConfig } from "@akashnetwork/net";
import { z } from "zod";

export const testEnvSchema = z.object({
  BASE_URL: z.string().default("http://localhost:3000"),
  TEST_WALLET_MNEMONIC: z.string(),
  UI_CONFIG_SIGNATURE_PRIVATE_KEY: z.string().optional(),
  NETWORK_ID: z.enum(netConfig.getSupportedNetworks() as [SupportedChainNetworks]).default("sandbox")
});

export const testEnvConfig = testEnvSchema.parse({
  BASE_URL: process.env.BASE_URL,
  TEST_WALLET_MNEMONIC: process.env.TEST_WALLET_MNEMONIC,
  UI_CONFIG_SIGNATURE_PRIVATE_KEY: process.env.UI_CONFIG_SIGNATURE_PRIVATE_KEY
});

export const PROVIDERS_WHITELIST = {
  mainnet: ["provider.hurricane.akash.pub", "provider.europlots.com"],
  sandbox: ["provider.provider-02.sandbox-01.aksh.pw", "provider.europlots-sandbox.com"],
  "testnet-02": [],
  "testnet-7": []
} satisfies Record<SupportedChainNetworks, string[]>;
