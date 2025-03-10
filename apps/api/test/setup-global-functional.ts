import path from "path";

import { localConfig } from "./services/local.config";
import { TestWalletService } from "./services/test-wallet.service";

export default async () => {
  if (!localConfig.MASTER_WALLET_MNEMONIC) {
    await TestWalletService.init({
      testsDir: path.join(__dirname, "functional")
    });
  }
};
