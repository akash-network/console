import type { TestWalletService } from "../services/test-wallet.service";

declare global {
  var testWalletService: TestWalletService;
}
