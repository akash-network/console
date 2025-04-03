import type { TestWalletService } from "../services/test-wallet.service";

declare global {
  // eslint-disable-next-line no-var
  var testWalletService: TestWalletService;
}
