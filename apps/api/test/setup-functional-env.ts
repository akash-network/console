import "reflect-metadata";

import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { expect } from "vitest";

import { localConfig } from "./services/local.config";
import { TestWalletService } from "./services/test-wallet.service";

dotenvExpand.expand(dotenv.config({ path: "env/.env.functional.test" }));

// Setup test wallets for functional tests
const testWalletService = new TestWalletService();

const setOrGenerateWallet = async (key: keyof typeof localConfig, generate?: () => Promise<string>) => {
  if (localConfig[key]) {
    process.env[key] = localConfig[key];
  } else {
    const newMnemonicPromise = generate ? generate() : testWalletService.generateMnemonic();
    process.env[key] = await newMnemonicPromise;
  }
};

const testPath = expect.getState().testPath;

// Initialize wallets asynchronously BEFORE any other imports
// Note: Each test file gets its own FUNDING_WALLET_MNEMONIC for parallel execution
await Promise.all([
  setOrGenerateWallet("FUNDING_WALLET_MNEMONIC", testPath ? () => testWalletService.getStoredMnemonic(testPath) : undefined),
  setOrGenerateWallet("DERIVATION_WALLET_MNEMONIC"),
  setOrGenerateWallet("OLD_MASTER_WALLET_MNEMONIC")
]);
