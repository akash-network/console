import { singleton } from "tsyringe";

import { MasterWalletMintService } from "@src/billing/services/master-wallet-mint/master-wallet-mint.service";
import type { DryRunOptions } from "@src/core/types/console";

@singleton()
export class MasterWalletMintController {
  constructor(private readonly masterWalletMintService: MasterWalletMintService) {}

  async mint(options: DryRunOptions) {
    return this.masterWalletMintService.mintIfNeeded(options);
  }
}
