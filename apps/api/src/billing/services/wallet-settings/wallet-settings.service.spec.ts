import { createMongoAbility } from "@casl/ability";
import { mock } from "jest-mock-extended";
import { PostgresError } from "postgres";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import { WalletSettingService } from "./wallet-settings.service";

import { UserSeeder } from "@test/seeders/user.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletSettingService.name, () => {
  describe("getWalletSetting", () => {
    it("returns wallet setting when found", async () => {
      const { user, walletSetting, walletSettingRepository, service } = setup();

      const result = await service.getWalletSetting(user.id);

      expect(result).toEqual(walletSetting);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
    });

    it("returns undefined when wallet setting not found", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      const result = await service.getWalletSetting(user.id);

      expect(result).toBeUndefined();
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
    });
  });

  describe("upsertWalletSetting", () => {
    it("updates existing wallet setting", async () => {
      const { user, walletSetting, walletSettingRepository, service } = setup();
      const updatedSetting = generateWalletSetting({
        userId: user.id,
        autoReloadEnabled: false,
        autoReloadThreshold: 20.75
      });
      walletSettingRepository.updateById.mockResolvedValue(updatedSetting as any);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: false,
        autoReloadThreshold: 20.75
      });

      expect(result).toEqual(updatedSetting);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(
        walletSetting.id,
        { autoReloadEnabled: false, autoReloadThreshold: 20.75 },
        { returning: true }
      );
    });

    it("creates new wallet setting when not exists", async () => {
      const { user, userWalletRepository, userWallet, walletSettingRepository, service } = setup();
      const newSetting = generateWalletSetting({ userId: user.id, walletId: userWallet.id });
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);
      walletSettingRepository.create.mockResolvedValue(newSetting);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });

      expect(result).toEqual(newSetting);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(walletSettingRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        walletId: userWallet.id,
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });
    });

    it("retries the update in case of a race condition", async () => {
      const { user, userWalletRepository, userWallet, walletSettingRepository, service } = setup();
      const newSetting = generateWalletSetting({ userId: user.id, walletId: userWallet.id });
      walletSettingRepository.findByUserId.mockResolvedValueOnce(undefined).mockResolvedValueOnce(newSetting);
      walletSettingRepository.updateById.mockResolvedValue(newSetting as any);
      walletSettingRepository.create.mockRejectedValue(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        new PostgresError({ message: 'duplicate key value violates unique constraint "wallet_settings_wallet_id_unique"', code: "23505" })
      );

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });

      expect(result).toEqual(newSetting);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(walletSettingRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        walletId: userWallet.id,
        autoReloadEnabled: true,
        autoReloadThreshold: 10.5,
        autoReloadAmount: 50.0
      });
    });

    it("throws 400 when enabled is true and threshold and amount are not provided during create", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true
        })
      ).rejects.toThrow('"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true');
    });

    it("throws 400 when enabled is true and only threshold is provided during create", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true,
          autoReloadThreshold: 15.5
        })
      ).rejects.toThrow('"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true');
    });

    it("throws 400 when enabled is true and only amount is provided during create", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true,
          autoReloadAmount: 25.0
        })
      ).rejects.toThrow('"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true');
    });

    it("updates existing setting using existing values when enabled is true and threshold and amount are not provided", async () => {
      const { user, walletSetting, walletSettingRepository, service } = setup();
      const updatedSetting = generateWalletSetting({
        userId: user.id,
        autoReloadEnabled: true,
        autoReloadThreshold: 15.5,
        autoReloadAmount: 25.0
      });
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
      walletSettingRepository.updateById.mockResolvedValue(updatedSetting as any);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: true
      });

      expect(result).toEqual(updatedSetting);
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(
        walletSetting.id,
        {
          autoReloadEnabled: true
        },
        { returning: true }
      );
    });

    it("throws 400 when enabled is true and existing setting does not have threshold and amount", async () => {
      const {
        user,
        walletSetting: { autoReloadThreshold, autoReloadAmount, ...walletSetting },
        walletSettingRepository,
        service
      } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true
        })
      ).rejects.toThrow('"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true');
    });

    it("throws 404 when user wallet not found during create", async () => {
      const { user, userWalletRepository, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true,
          autoReloadThreshold: 20,
          autoReloadAmount: 20
        })
      ).rejects.toThrow("UserWallet Not Found");
    });
  });

  describe("deleteWalletSetting", () => {
    it("deletes wallet setting", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.deleteBy.mockResolvedValue(undefined);

      await service.deleteWalletSetting(user.id);

      expect(walletSettingRepository.deleteBy).toHaveBeenCalledWith({ userId: user.id });
    });
  });

  function setup() {
    const user = UserSeeder.create();
    const userWallet = UserWalletSeeder.create({ userId: user.id });
    const walletSettingRepository = mock<WalletSettingRepository>();
    walletSettingRepository.accessibleBy.mockReturnValue(walletSettingRepository);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);
    const walletSetting = generateWalletSetting({ userId: user.id });
    walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
    const ability = createMongoAbility();
    const authService = mock<AuthService>({
      currentUser: user,
      ability
    });
    const service = new WalletSettingService(walletSettingRepository, userWalletRepository, authService);

    return {
      user,
      userWallet,
      walletSetting,
      walletSettingRepository,
      userWalletRepository,
      authService,
      service
    };
  }
});
