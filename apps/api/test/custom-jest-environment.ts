import type { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";
import NodeEnvironment from "jest-environment-node";

import { Wallet } from "../src/billing/lib/wallet/wallet";
import { localConfig } from "./services/local.config";
import { TestWalletService } from "./services/test-wallet.service";

export default class CustomJestEnvironment extends NodeEnvironment {
  private readonly path: string;

  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);
    this.path = context.testPath;
  }

  async setup() {
    await super.setup();
    if (localConfig.FUNDING_WALLET_MNEMONIC) {
      this.global.process.env.FUNDING_WALLET_MNEMONIC = localConfig.FUNDING_WALLET_MNEMONIC;
    } else {
      this.global.process.env.FUNDING_WALLET_MNEMONIC = new TestWalletService().getMnemonic(this.path);
    }

    if (localConfig.DERIVATION_WALLET_MNEMONIC) {
      this.global.process.env.DERIVATION_WALLET_MNEMONIC = localConfig.DERIVATION_WALLET_MNEMONIC;
    } else {
      this.global.process.env.DERIVATION_WALLET_MNEMONIC = await new Wallet().getMnemonic();
    }

    if (localConfig.OLD_MASTER_WALLET_MNEMONIC) {
      this.global.process.env.OLD_MASTER_WALLET_MNEMONIC = localConfig.OLD_MASTER_WALLET_MNEMONIC;
    } else {
      this.global.process.env.OLD_MASTER_WALLET_MNEMONIC = await new Wallet().getMnemonic();
    }
  }
}
