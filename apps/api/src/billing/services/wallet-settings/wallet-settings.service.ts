import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository, type WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";

export interface WalletSetting {
  autoReloadEnabled?: boolean;
  autoReloadThreshold?: number;
  autoReloadAmount?: number;
}

@singleton()
export class WalletSettingService {
  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService
  ) {}

  async getWalletSetting(userId: string): Promise<WalletSettingOutput | undefined> {
    const { ability } = this.authService;

    return await this.walletSettingRepository.accessibleBy(ability, "read").findByUserId(userId);
  }

  async upsertWalletSetting(userId: string, settings: WalletSetting): Promise<WalletSettingOutput> {
    const { ability } = this.authService;

    const existingSetting = await this.walletSettingRepository.accessibleBy(ability, "read").findByUserId(userId);

    if (existingSetting) {
      this.validate(settings, existingSetting);
      const updatedSetting = await this.walletSettingRepository.accessibleBy(ability, "update").updateById(existingSetting.id, settings, { returning: true });

      assert(updatedSetting, 404, "WalletSetting Not Found");

      return updatedSetting;
    }

    this.validate(settings);

    const userWallet = await this.userWalletRepository.findOneByUserId(userId);

    assert(userWallet, 404, "UserWallet Not Found");

    const newSetting = await this.walletSettingRepository.accessibleBy(ability, "create").create({
      userId,
      walletId: userWallet.id,
      ...settings
    });

    return newSetting;
  }

  private validate(settings: WalletSetting, existingSetting?: WalletSettingOutput) {
    if (settings.autoReloadEnabled === true) {
      const threshold = settings.autoReloadThreshold ?? existingSetting?.autoReloadThreshold;
      const amount = settings.autoReloadAmount ?? existingSetting?.autoReloadAmount;

      if (threshold === undefined || amount === undefined) {
        assert(false, 400, '"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true');
      }
    }
  }

  async deleteWalletSetting(userId: string): Promise<void> {
    const { ability } = this.authService;
    await this.walletSettingRepository.accessibleBy(ability, "delete").deleteBy({ userId });
  }
}
