import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { isAutoReloadActive } from "@src/billing/lib/auto-reload/auto-reload";
import type { WalletBillingTarget } from "@src/billing/lib/wallet-billing-target/wallet-billing-target";
import { isWalletInitialized, UserWalletRepository, type WalletInitialized, WalletSettingRepository } from "@src/billing/repositories";
import { BillingContactsService } from "@src/billing/services/billing-contacts/billing-contacts.service";
import type { UserOutput } from "@src/user/repositories";

export type CreditsWarningIneligibility = "auto_reload_enabled" | "no_wallet" | "trialing" | "abuse_locked" | "no_email";

export interface CreditsWarningRecipient {
  wallet: WalletInitialized;
  users: UserOutput[];
}

@singleton()
export class CreditsWarningRecipientService {
  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly billingContactsService: BillingContactsService
  ) {}

  async find(target: WalletBillingTarget): Promise<Result<CreditsWarningRecipient, CreditsWarningIneligibility>> {
    const walletSetting = await this.walletSettingRepository.findByTarget(target);
    if (isAutoReloadActive(walletSetting)) {
      return Err("auto_reload_enabled");
    }

    const wallet = "userId" in target ? await this.userWalletRepository.findOneByUserId(target.userId) : await this.userWalletRepository.findById(target.walletId);
    if (!wallet || !isWalletInitialized(wallet)) {
      return Err("no_wallet");
    }

    if (wallet.isTrialing) {
      return Err("trialing");
    }

    if (wallet.abuseLockedAt) {
      return Err("abuse_locked");
    }

    const users = (await this.billingContactsService.findForWallet("userId" in target ? { ...wallet, userId: target.userId } : wallet)).filter(
      user => !!user.email
    );
    if (!users.length) {
      return Err("no_email");
    }

    return Ok({ wallet, users });
  }
}
