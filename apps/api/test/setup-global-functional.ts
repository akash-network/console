import path from "path";

import { TestWalletService } from "./services/test-wallet.service";

export default async () => {
  await TestWalletService.init({
    testsDir: path.join(__dirname, "functional")
  });
};
