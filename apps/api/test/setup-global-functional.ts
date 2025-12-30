import { localConfig } from "./services/local.config";
import { TestWalletService } from "./services/test-wallet.service";

export default async () => {
  if (!localConfig.FUNDING_WALLET_MNEMONIC) {
    await new TestWalletService().init();
  }
};
