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
    if (localConfig.FUNDING_WALLET_MNEMONIC) {
      this.global.process.env.FUNDING_WALLET_MNEMONIC = localConfig.FUNDING_WALLET_MNEMONIC;
    } else {
      this.global.process.env.FUNDING_WALLET_MNEMONIC = this.#getTestWalletService().getMnemonic(this.#path);
    }

    if (localConfig.DERIVATION_WALLET_MNEMONIC) {
      this.global.process.env.DERIVATION_WALLET_MNEMONIC = localConfig.DERIVATION_WALLET_MNEMONIC;
    } else {
      this.global.process.env.DERIVATION_WALLET_MNEMONIC = await this.#getTestWalletService().generateMnemonic();
    }

    if (localConfig.OLD_MASTER_WALLET_MNEMONIC) {
      this.global.process.env.OLD_MASTER_WALLET_MNEMONIC = localConfig.OLD_MASTER_WALLET_MNEMONIC;
    } else {
      this.global.process.env.OLD_MASTER_WALLET_MNEMONIC = await this.#getTestWalletService().generateMnemonic();
    }
  }
}
