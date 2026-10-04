import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { isAutoReloadActive } from "@src/billing/lib/auto-reload/auto-reload";
import { isWalletInitialized, UserWalletRepository, type WalletInitialized, WalletSettingRepository } from "@src/billing/repositories";
import { type UserOutput, UserRepository } from "@src/user/repositories";

export type CreditsWarningIneligibility = "auto_reload_enabled" | "no_wallet" | "trialing" | "abuse_locked" | "no_email";

export interface CreditsWarningRecipient {
  wallet: WalletInitialized;
  user: UserOutput;
}

@singleton()
export class CreditsWarningRecipientService {
  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository
  ) {}

  async find(userId: UserOutput["id"]): Promise<Result<CreditsWarningRecipient, CreditsWarningIneligibility>> {
    const walletSetting = await this.walletSettingRepository.findByUserId(userId);
    if (isAutoReloadActive(walletSetting)) {
      return Err("auto_reload_enabled");
    }

    const wallet = await this.userWalletRepository.findOneByUserId(userId);
    if (!wallet || !isWalletInitialized(wallet)) {
      return Err("no_wallet");
    }

    if (wallet.isTrialing) {
      return Err("trialing");
    }

    if (wallet.abuseLockedAt) {
      return Err("abuse_locked");
    }

    const user = await this.userRepository.findById(userId);
    if (!user?.email) {
      return Err("no_email");
    }

    return Ok({ wallet, user });
  }
}
