import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import * as fs from "fs";
import { sep as FOLDER_SEP } from "path";

import { reusePendingPromise } from "@src/caching/helpers";
import { WALLET_ADDRESS_PREFIX } from "../../src/billing/lib/wallet/wallet";

export class TestWalletService {
  private mnemonics: Record<string, string> = {};

  constructor() {
    this.restoreCache();
    this.getStoredMnemonic = reusePendingPromise(this.getStoredMnemonic, {
      getKey: (path: string) => `test-wallet-mnemonic-${this.getFileName(path)}`
    });
  }

  private restoreCache() {
    if (fs.existsSync(".cache/test-wallets.json")) {
      this.mnemonics = JSON.parse(fs.readFileSync(".cache/test-wallets.json", "utf8"));
    }
  }

  private saveCache() {
    if (!fs.existsSync(".cache")) {
      fs.mkdirSync(".cache", { recursive: true });
    }

    fs.writeFileSync(".cache/test-wallets.json", JSON.stringify(this.mnemonics, null, 2));
  }

  async getStoredMnemonic(path: string): Promise<string> {
    const fileName = this.getFileName(path);

    if (!this.mnemonics[fileName]) {
      this.mnemonics[fileName] ??= await this.generateMnemonic();
      this.saveCache();
    }
    return this.mnemonics[fileName];
  }

  async generateMnemonic() {
    const hdWallet = await DirectSecp256k1HdWallet.generate(24, { prefix: WALLET_ADDRESS_PREFIX });
    return hdWallet.mnemonic;
  }

  private getFileName(path: string) {
    return path.split(FOLDER_SEP).pop()!;
  }
}
