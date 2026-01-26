import type { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";
import NodeEnvironment from "jest-environment-node";

import { localConfig } from "./services/local.config";
import { TestWalletService } from "./services/test-wallet.service";

export default class CustomJestEnvironment extends NodeEnvironment {
  readonly #path: string;
  #testWalletService?: TestWalletService;

  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);
    this.#path = context.testPath;
  }

  #getTestWalletService() {
    this.#testWalletService ??= new TestWalletService();
    return this.#testWalletService;
  }

  async setup() {
    await super.setup();
    await Promise.all([
      this.#setOrGenerateWallet("FUNDING_WALLET_MNEMONIC", () => this.#getTestWalletService().getStoredMnemonic(this.#path)),
      this.#setOrGenerateWallet("DERIVATION_WALLET_MNEMONIC"),
      this.#setOrGenerateWallet("OLD_MASTER_WALLET_MNEMONIC")
    ]);
  }

  async #setOrGenerateWallet(key: keyof typeof localConfig, generate?: () => Promise<string>) {
    if (localConfig[key]) {
      this.global.process.env[key] = localConfig[key];
    } else {
      const newMnemonicPromise = generate ? generate() : this.#getTestWalletService().generateMnemonic();
      this.global.process.env[key] = await newMnemonicPromise;
    }
  }
}
