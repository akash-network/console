import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { WalletSettingService } from "@src/billing/services/wallet-settings/wallet-settings.service";
import { WalletSettingController } from "./wallet-settings.controller";

import { UserSeeder } from "@test/seeders/user.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletSettingController.name, () => {
  describe("getWalletSettings", () => {
    it("returns wallet settings when found", async () => {
      const { user, walletSettingService, controller, walletSetting } = setup();
      walletSettingService.getWalletSetting.mockResolvedValue(walletSetting);

      const result = await controller.getWalletSettings();

      expect(result).toEqual({
        data: walletSetting
      });
      expect(walletSettingService.getWalletSetting).toHaveBeenCalledWith(user.id);
    });

    it("throws 404 when wallet settings not found", async () => {
      const { user, walletSettingService, controller } = setup();
      walletSettingService.getWalletSetting.mockResolvedValue(undefined);

      await expect(() => controller.getWalletSettings()).rejects.toThrow("WalletSetting Not Found");
      expect(walletSettingService.getWalletSetting).toHaveBeenCalledWith(user.id);
    });
  });

  describe("createWalletSettings", () => {
    it("creates wallet settings", async () => {
      const { user, walletSettingService, controller, walletSetting } = setup();
      walletSettingService.upsertWalletSetting.mockResolvedValue(walletSetting);

      const result = await controller.createWalletSettings({
        data: {
          autoReloadEnabled: true,
          autoReloadThreshold: 10.5,
          autoReloadAmount: 50.0
        }
      });

      expect(result).toEqual({
        data: walletSetting
      });
      expect(walletSettingService.upsertWalletSetting).toHaveBeenCalledWith(user.id, {
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });
    });
  });

  describe("updateWalletSettings", () => {
    it("updates wallet settings", async () => {
      const { user, walletSettingService, controller, walletSetting } = setup();

      walletSettingService.upsertWalletSetting.mockResolvedValue(walletSetting);

      const result = await controller.updateWalletSettings({
        data: {
          autoReloadEnabled: false,
          autoReloadThreshold: 20.75
        }
      });

      expect(result).toEqual({
        data: walletSetting
      });
      expect(walletSettingService.upsertWalletSetting).toHaveBeenCalledWith(user.id, {
        autoReloadEnabled: false,
        autoReloadThreshold: 20.75
      });
    });
  });

  describe("deleteWalletSettings", () => {
    it("deletes wallet settings", async () => {
      const { user, walletSettingService, controller } = setup();
      walletSettingService.deleteWalletSetting.mockResolvedValue(undefined);

      await controller.deleteWalletSettings();

      expect(walletSettingService.deleteWalletSetting).toHaveBeenCalledWith(user.id);
    });
  });

  function setup() {
    const user = UserSeeder.create();
    const walletSetting = generateWalletSetting({
      userId: user.id
    });
    const walletSettingService = mock<WalletSettingService>();
    const authService = mock<AuthService>({
      currentUser: user
    });
    const controller = new WalletSettingController(walletSettingService, authService);
    container.register(AuthService, { useValue: authService });

    return {
      user,
      walletSettingService,
      authService,
      controller,
      walletSetting
    };
  }
});
