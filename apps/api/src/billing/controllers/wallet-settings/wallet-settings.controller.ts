import assert from "http-assert";
import { Lifecycle, scoped } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { CreateWalletSettingsRequest, UpdateWalletSettingsRequest, WalletSettingsResponse } from "@src/billing/http-schemas/wallet.schema";
import { WalletSettingService } from "@src/billing/services/wallet-settings/wallet-settings.service";

@scoped(Lifecycle.ResolutionScoped)
export class WalletSettingController {
  constructor(
    private readonly walletSettingService: WalletSettingService,
    private readonly authService: AuthService
  ) {}

  @Protected([{ action: "read", subject: "WalletSetting" }])
  async getWalletSettings(): Promise<WalletSettingsResponse> {
    const { currentUser } = this.authService;

    const settings = await this.walletSettingService.getWalletSetting(currentUser.id);

    assert(settings, 404, "WalletSetting Not Found");

    return {
      data: settings
    };
  }

  @Protected()
  async createWalletSettings(input: CreateWalletSettingsRequest): Promise<WalletSettingsResponse> {
    const { currentUser } = this.authService;
    const { data } = input;

    const settings = await this.walletSettingService.upsertWalletSetting(currentUser.id, data);

    return {
      data: settings
    };
  }

  @Protected()
  async updateWalletSettings(input: UpdateWalletSettingsRequest): Promise<WalletSettingsResponse> {
    const { currentUser } = this.authService;
    const { data } = input;

    const settings = await this.walletSettingService.upsertWalletSetting(currentUser.id, data);

    return {
      data: settings
    };
  }

  @Protected([{ action: "delete", subject: "WalletSetting" }])
  async deleteWalletSettings(): Promise<void> {
    const { currentUser } = this.authService;

    return this.walletSettingService.deleteWalletSetting(currentUser.id);
  }
}
