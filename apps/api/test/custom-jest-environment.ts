import type { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";
import NodeEnvironment from "jest-environment-node";

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
    if (localConfig.MASTER_WALLET_MNEMONIC) {
      this.global.process.env.MASTER_WALLET_MNEMONIC = localConfig.MASTER_WALLET_MNEMONIC;
    } else {
      this.global.process.env.MASTER_WALLET_MNEMONIC = new TestWalletService().getMnemonic(this.path);
    }
  }
}
