import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { PostgresError } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import { centsToUsd } from "@src/billing/lib/currency/currency";
import type { UserWalletRepository, WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import type { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { type PaymentMethod } from "@src/billing/services/payment-method/payment-method.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { UserRepository } from "@src/user/repositories";
import { WalletSettingService } from "./wallet-settings.service";

import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletSettingService.name, () => {
  describe("getWalletSetting", () => {
    it("returns wallet setting when found", async () => {
      const { user, publicSetting, walletSettingRepository, service } = setup();

      const result = await service.getWalletSetting(user.id);

      expect(result).toEqual(publicSetting);
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
      const { user, publicSetting, walletSetting, walletSettingRepository, service } = setup();
      const updatedSetting = generateWalletSetting({
        ...walletSetting,
        autoReloadEnabled: false
      });
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
      walletSettingRepository.updateById.mockResolvedValue(updatedSetting as any);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: false
      });

      expect(result).toEqual(toPublicSetting(updatedSetting));
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(publicSetting.id, { autoReloadEnabled: false }, { returning: true });
    });

    it("creates new wallet setting when not exists", async () => {
      const { user, userWalletRepository, userWallet, walletSettingRepository, walletReloadJobService, jobId, service } = setup();
      const newSetting = generateWalletSetting({
        userId: user.id,
        walletId: userWallet.id,
        autoReloadEnabled: true
      });
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);
      walletSettingRepository.create.mockResolvedValue(newSetting);
      walletReloadJobService.scheduleForWalletSetting.mockResolvedValue(jobId);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: true
      });

      expect(result).toEqual(toPublicSetting(newSetting));
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(walletSettingRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        walletId: userWallet.id,
        autoReloadEnabled: true
      });
      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(
        expect.objectContaining({
          id: newSetting.id,
          userId: user.id
        }),
        { withCleanup: true }
      );
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
        autoReloadEnabled: true
      });

      expect(result).toEqual(toPublicSetting(newSetting));
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(user.id);
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(user.id);
      expect(walletSettingRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        walletId: userWallet.id,
        autoReloadEnabled: true
      });
    });

    it("updates existing setting when enabled is true", async () => {
      const { user, walletSetting, walletSettingRepository, walletReloadJobService, jobId, service } = setup();
      const existingSetting = { ...walletSetting, autoReloadEnabled: false };
      const updatedSetting = generateWalletSetting({
        userId: user.id,
        autoReloadEnabled: true
      });
      walletSettingRepository.findByUserId.mockResolvedValue(existingSetting);
      walletSettingRepository.updateById.mockResolvedValue(updatedSetting as any);
      walletReloadJobService.scheduleForWalletSetting.mockResolvedValue(jobId);

      const result = await service.upsertWalletSetting(user.id, {
        autoReloadEnabled: true
      });

      expect(result).toEqual(toPublicSetting(updatedSetting));
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(
        existingSetting.id,
        {
          autoReloadEnabled: true
        },
        { returning: true }
      );
      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(
        expect.objectContaining({
          id: updatedSetting.id,
          userId: user.id
        }),
        { withCleanup: true }
      );
    });

    it("schedules an immediate check when reload values change while enabled", async () => {
      const { user, walletSetting, walletSettingRepository, walletReloadJobService, jobId, service } = setup();
      const enabledPrev = { ...walletSetting, autoReloadEnabled: true, autoReloadThreshold: 2000, autoReloadAmount: 10000 };
      const updated = { ...enabledPrev, autoReloadThreshold: 3000 };
      walletSettingRepository.findByUserId.mockResolvedValue(enabledPrev);
      walletSettingRepository.updateById.mockResolvedValue(updated as any);
      walletReloadJobService.scheduleForWalletSetting.mockResolvedValue(jobId);

      await service.upsertWalletSetting(user.id, { autoReloadThreshold: 30 });

      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(expect.objectContaining({ id: updated.id, userId: user.id }), {
        withCleanup: true
      });
    });

    it("does not schedule a check when reload values are unchanged while enabled", async () => {
      const { user, walletSetting, walletSettingRepository, walletReloadJobService, service } = setup();
      const enabledSetting = { ...walletSetting, autoReloadEnabled: true, autoReloadThreshold: 2000, autoReloadAmount: 10000 };
      walletSettingRepository.findByUserId.mockResolvedValue(enabledSetting);
      walletSettingRepository.updateById.mockResolvedValue(enabledSetting as any);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true });

      expect(walletReloadJobService.scheduleForWalletSetting).not.toHaveBeenCalled();
    });

    it("persists reload amounts as integer cents and returns them in dollars", async () => {
      const { user, walletSetting, walletSettingRepository, walletReloadJobService, jobId, service } = setup();
      const existingSetting = { ...walletSetting, autoReloadEnabled: true };
      walletSettingRepository.findByUserId.mockResolvedValue(existingSetting);
      walletSettingRepository.updateById.mockResolvedValue({ ...existingSetting, autoReloadThreshold: 2500, autoReloadAmount: 15000 } as any);
      walletReloadJobService.scheduleForWalletSetting.mockResolvedValue(jobId);

      const result = await service.upsertWalletSetting(user.id, { autoReloadThreshold: 25, autoReloadAmount: 150 });

      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(
        existingSetting.id,
        { autoReloadThreshold: 2500, autoReloadAmount: 15000 },
        { returning: true }
      );
      expect(result.autoReloadThreshold).toBe(25);
      expect(result.autoReloadAmount).toBe(150);
    });

    it("throws when enabling without a default payment method", async () => {
      const { user, walletSetting, walletSettingRepository, paymentMethodService, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue({ ...walletSetting, autoReloadEnabled: false });
      paymentMethodService.getDefaultPaymentMethod.mockResolvedValue(undefined);

      await expect(() => service.upsertWalletSetting(user.id, { autoReloadEnabled: true })).rejects.toThrow(
        "Default payment method is required to enable automatic wallet balance reload"
      );
    });

    it("throws 404 when user wallet not found during create", async () => {
      const { user, userWalletRepository, walletSettingRepository, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      await expect(() =>
        service.upsertWalletSetting(user.id, {
          autoReloadEnabled: true
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

  describe("disableAutoReload", () => {
    it("disables auto reload and cancels the pending reload job", async () => {
      const { user, walletSettingRepository, walletReloadJobService, service } = setup();
      const enabledSetting = generateWalletSetting({ userId: user.id, autoReloadEnabled: true });
      walletSettingRepository.findByUserId.mockResolvedValue(enabledSetting);

      await service.disableAutoReload(user.id);

      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(enabledSetting.id, { autoReloadEnabled: false });
      expect(walletReloadJobService.cancelCreatedByUserId).toHaveBeenCalledWith(user.id);
    });

    it("does nothing when auto reload is already disabled", async () => {
      const { user, walletSettingRepository, walletReloadJobService, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(generateWalletSetting({ userId: user.id, autoReloadEnabled: false }));

      await service.disableAutoReload(user.id);

      expect(walletSettingRepository.updateById).not.toHaveBeenCalled();
      expect(walletReloadJobService.cancelCreatedByUserId).not.toHaveBeenCalled();
    });

    it("does nothing when the user has no wallet settings", async () => {
      const { user, walletSettingRepository, walletReloadJobService, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      await service.disableAutoReload(user.id);

      expect(walletSettingRepository.updateById).not.toHaveBeenCalled();
      expect(walletReloadJobService.cancelCreatedByUserId).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const user = createUser();
    const userWithStripe = { ...user, stripeCustomerId: faker.string.uuid() };
    const userWallet = createUserWallet({ userId: user.id });
    const walletSettingRepository = mock<WalletSettingRepository>();
    walletSettingRepository.accessibleBy.mockReturnValue(walletSettingRepository);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(userWithStripe);
    const paymentMethod = { ...generatePaymentMethod(), validated: true };
    const paymentMethodService = mock<PaymentMethodService>({
      getDefaultPaymentMethod: vi.fn().mockResolvedValue(paymentMethod as PaymentMethod)
    });
    const walletSetting = generateWalletSetting({ userId: user.id });
    walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
    const ability = createMongoAbility();
    const authService = mock<AuthService>({
      currentUser: user,
      ability
    });
    const jobId = faker.string.uuid();
    const walletReloadJobService = mock<WalletReloadJobService>({
      scheduleForWalletSetting: vi.fn().mockResolvedValue(jobId)
    });
    const logger = mock<LoggerService>();
    const service = new WalletSettingService(
      walletSettingRepository,
      userWalletRepository,
      userRepository,
      paymentMethodService,
      authService,
      walletReloadJobService,
      logger
    );

    return {
      user: userWithStripe,
      userWallet,
      walletSetting,
      publicSetting: toPublicSetting(walletSetting),
      walletSettingRepository,
      userWalletRepository,
      userRepository,
      paymentMethodService,
      authService,
      walletReloadJobService,
      jobId,
      service
    };
  }
});

function toPublicSetting(setting: WalletSettingOutput): WalletSettingOutput {
  return {
    ...setting,
    autoReloadThreshold: centsToUsd(setting.autoReloadThreshold),
    autoReloadAmount: centsToUsd(setting.autoReloadAmount)
  };
}
