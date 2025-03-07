import type { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";
import NodeEnvironment from "jest-environment-node";

import { TestWalletService } from "./services/test-wallet.service";

export default class CustomJestEnvironment extends NodeEnvironment {
  private readonly path: string;

  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);
    this.path = context.testPath;
  }

  async setup() {
    await super.setup();
    const mnemonic = TestWalletService.instance.getMnemonic(this.path);
    this.global.process.env.MASTER_WALLET_MNEMONIC = mnemonic;
  }
}
