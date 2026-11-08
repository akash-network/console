import { singleton } from "tsyringe";

import { walletBillingTargetOf } from "@src/billing/lib/wallet-billing-target/wallet-billing-target";
import { type UserWalletOutput, WalletSettingRepository } from "@src/billing/repositories";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { UnscopedReason } from "@src/core/repositories/unscoped-reasons";

@singleton()
export class AutoReloadShutoffService {
  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly walletReloadJobService: WalletReloadJobService
  ) {}

  /** The queued checks are cancelled by the wallet's billing target, since a personal wallet's are keyed by its user and a team's by its wallet. */
  async turnOff(wallet: Pick<UserWalletOutput, "id" | "userId">, reason: UnscopedReason): Promise<void> {
    const target = walletBillingTargetOf(wallet);

    await this.walletSettingRepository.unscoped(reason).updateBy({ walletId: wallet.id }, { autoReloadEnabled: false });
    await this.walletReloadJobService.cancelReloadCheck(target);
    await this.walletReloadJobService.cancelCreditsLowCheck(target);
  }
}
