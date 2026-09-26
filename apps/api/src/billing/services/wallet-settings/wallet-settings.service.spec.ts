import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { PaymentMethod, PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { TxService } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { UserRepository } from "@src/user/repositories";
import { WalletSettingService } from "./wallet-settings.service";

import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletSettingService.name, () => {
  describe("upsertWalletSetting", () => {
    it("cancels the credits-low job and clears creditsLowNotifiedAt when Auto Recharge is enabled", async () => {
      const { user, walletSetting, walletSettingRepository, walletReloadJobService, userWalletRepository, jobId, service } = setup();
      const disabledSetting = { ...walletSetting, autoReloadEnabled: false };
      const enabledSetting = generateWalletSetting({
        userId: user.id,
        walletId: walletSetting.walletId,
        autoReloadEnabled: true
      });
      walletSettingRepository.findOneByAndLock.mockResolvedValue(disabledSetting);
      walletSettingRepository.updateById.mockResolvedValue(enabledSetting as never);
      walletReloadJobService.scheduleForWalletSetting.mockResolvedValue(jobId);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true });

      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(
        expect.objectContaining({
          id: enabledSetting.id,
          userId: user.id
        }),
        { withCleanup: true }
      );
      expect(walletReloadJobService.cancelCreditsLowCheckByUserId).toHaveBeenCalledWith(user.id);
      expect(userWalletRepository.updateById).toHaveBeenCalledWith(enabledSetting.walletId, {
        creditsLowNotifiedAt: null,
        creditsSufficientSince: null,
        creditsLowSince: null
      });
    });

    it("lifts a decline pause and reopens the charge window when the settings are saved", async () => {
      const { user, walletSetting, walletSettingRepository, service } = setup();
      const pausedSetting = { ...walletSetting, autoReloadEnabled: true, autoReloadPausedAt: new Date(), autoReloadFailureCount: 4 };
      walletSettingRepository.findOneByAndLock.mockResolvedValue(pausedSetting);
      walletSettingRepository.updateById.mockResolvedValue({ ...pausedSetting, autoReloadPausedAt: null, autoReloadFailureCount: 0 } as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true, autoReloadAmount: 100 });

      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(
        pausedSetting.id,
        expect.objectContaining({ autoReloadFailureCount: 0, autoReloadPausedAt: null, lastAutoChargeAt: null }),
        { returning: true }
      );
    });

    it("schedules a check after lifting a pause even when no setting changed", async () => {
      const { user, walletSetting, walletSettingRepository, walletReloadJobService, service } = setup();
      const pausedSetting = { ...walletSetting, autoReloadEnabled: true, autoReloadPausedAt: new Date() };
      walletSettingRepository.findOneByAndLock.mockResolvedValue(pausedSetting);
      walletSettingRepository.updateById.mockResolvedValue({ ...pausedSetting, autoReloadPausedAt: null } as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true });

      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(expect.objectContaining({ id: pausedSetting.id }), { withCleanup: true });
    });

    it("clears the credits-low latch the pause left behind", async () => {
      const { user, walletSetting, walletSettingRepository, walletReloadJobService, userWalletRepository, service } = setup();
      const pausedSetting = { ...walletSetting, autoReloadEnabled: true, autoReloadPausedAt: new Date() };
      walletSettingRepository.findOneByAndLock.mockResolvedValue(pausedSetting);
      walletSettingRepository.updateById.mockResolvedValue({ ...pausedSetting, autoReloadPausedAt: null } as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true });

      expect(walletReloadJobService.cancelCreditsLowCheckByUserId).toHaveBeenCalledWith(user.id);
      expect(userWalletRepository.updateById).toHaveBeenCalledWith(pausedSetting.walletId, {
        creditsLowNotifiedAt: null,
        creditsSufficientSince: null,
        creditsLowSince: null
      });
    });

    it("leaves the charge window alone when the wallet was never paused", async () => {
      const { user, walletSetting, walletSettingRepository, service } = setup();
      const enabledSetting = { ...walletSetting, autoReloadEnabled: true, autoReloadPausedAt: null };
      walletSettingRepository.findOneByAndLock.mockResolvedValue(enabledSetting);
      walletSettingRepository.updateById.mockResolvedValue(enabledSetting as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true, autoReloadAmount: 100 });

      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(enabledSetting.id, expect.not.objectContaining({ lastAutoChargeAt: null }), {
        returning: true
      });
    });

    it("enqueues a credits-low check when Auto Recharge is disabled", async () => {
      const { user, walletSetting, walletSettingRepository, walletReloadJobService, service } = setup();
      const enabledSetting = { ...walletSetting, autoReloadEnabled: true };
      const disabledSetting = { ...walletSetting, autoReloadEnabled: false };
      walletSettingRepository.findOneByAndLock.mockResolvedValue(enabledSetting);
      walletSettingRepository.updateById.mockResolvedValue(disabledSetting as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: false });

      expect(walletReloadJobService.scheduleCreditsLowCheck).toHaveBeenCalledWith(user.id, { withCleanup: true });
      expect(walletReloadJobService.scheduleForWalletSetting).not.toHaveBeenCalled();
    });

    it("reports Auto Recharge turned on with the threshold and amount of a threshold rule", async () => {
      const { user, walletSetting, walletSettingRepository, analyticsService, service } = setup();
      walletSettingRepository.findOneByAndLock.mockResolvedValue({ ...walletSetting, autoReloadEnabled: false });
      walletSettingRepository.updateById.mockResolvedValue({
        ...walletSetting,
        autoReloadEnabled: true,
        autoReloadMode: "threshold",
        autoReloadThreshold: 1000,
        autoReloadAmount: 2500
      } as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true, autoReloadMode: "threshold", autoReloadThreshold: 10, autoReloadAmount: 25 });

      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "auto_recharge_enabled", { mode: "threshold", threshold_usd: 10, amount_usd: 25 });
    });

    it("reports Auto Recharge turned on when the first saved setting enables it", async () => {
      const { user, walletSetting, walletSettingRepository, analyticsService, service } = setup();
      walletSettingRepository.findOneByAndLock.mockResolvedValue(undefined);
      walletSettingRepository.createUnlessExists.mockResolvedValue({ ...walletSetting, autoReloadEnabled: true, autoReloadMode: "prediction" });

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true, autoReloadMode: "prediction" });

      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "auto_recharge_enabled", { mode: "prediction" });
    });

    it("reports Auto Recharge turned on in prediction mode without the threshold rule it ignores", async () => {
      const { user, walletSetting, walletSettingRepository, analyticsService, service } = setup();
      walletSettingRepository.findOneByAndLock.mockResolvedValue({ ...walletSetting, autoReloadEnabled: false });
      walletSettingRepository.updateById.mockResolvedValue({ ...walletSetting, autoReloadEnabled: true, autoReloadMode: "prediction" } as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true, autoReloadMode: "prediction" });

      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "auto_recharge_enabled", { mode: "prediction" });
    });

    it("reports Auto Recharge turned off by the user", async () => {
      const { user, walletSetting, walletSettingRepository, analyticsService, service } = setup();
      walletSettingRepository.findOneByAndLock.mockResolvedValue({ ...walletSetting, autoReloadEnabled: true });
      walletSettingRepository.updateById.mockResolvedValue({ ...walletSetting, autoReloadEnabled: false } as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: false });

      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "auto_recharge_disabled", { disabled_by: "user" });
    });

    it("reports nothing when saved settings keep Auto Recharge on", async () => {
      const { user, walletSetting, walletSettingRepository, analyticsService, service } = setup();
      const enabledSetting = { ...walletSetting, autoReloadEnabled: true };
      walletSettingRepository.findOneByAndLock.mockResolvedValue(enabledSetting);
      walletSettingRepository.updateById.mockResolvedValue(enabledSetting as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true, autoReloadAmount: 100 });

      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("creates the first setting on the user's wallet", async () => {
      const { user, userWallet, walletSetting, walletSettingRepository, service } = setup();
      walletSettingRepository.findOneByAndLock.mockResolvedValue(undefined);
      walletSettingRepository.createUnlessExists.mockResolvedValue({ ...walletSetting, autoReloadEnabled: true });

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true });

      expect(walletSettingRepository.accessibleBy).toHaveBeenCalledWith(expect.anything(), "create");
      expect(walletSettingRepository.createUnlessExists).toHaveBeenCalledWith({ userId: user.id, walletId: userWallet.id, autoReloadEnabled: true });
      expect(walletSettingRepository.updateById).not.toHaveBeenCalled();
    });

    it("updates the setting another save created first", async () => {
      const { user, walletSetting, walletSettingRepository, analyticsService, service } = setup();
      const createdByOtherSave = { ...walletSetting, autoReloadEnabled: true };
      walletSettingRepository.findOneByAndLock.mockResolvedValueOnce(undefined).mockResolvedValueOnce(createdByOtherSave);
      walletSettingRepository.createUnlessExists.mockResolvedValue(undefined);
      walletSettingRepository.updateById.mockResolvedValue(createdByOtherSave as never);

      const saved = await service.upsertWalletSetting(user.id, { autoReloadEnabled: true });

      expect(saved.autoReloadEnabled).toBe(true);
      expect(walletSettingRepository.updateById).toHaveBeenCalledWith(createdByOtherSave.id, { autoReloadEnabled: true }, { returning: true });
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("fails when the setting another save created cannot be read back", async () => {
      const { user, walletSettingRepository, service } = setup();
      walletSettingRepository.findOneByAndLock.mockResolvedValue(undefined);
      walletSettingRepository.createUnlessExists.mockResolvedValue(undefined);

      await expect(service.upsertWalletSetting(user.id, { autoReloadEnabled: false })).rejects.toThrow("Failed to create a wallet setting");
    });

    it("locks the setting row the current user can read", async () => {
      const { user, walletSetting, walletSettingRepository, service } = setup();
      walletSettingRepository.updateById.mockResolvedValue(walletSetting as never);

      await service.upsertWalletSetting(user.id, { autoReloadAmount: 100 });

      expect(walletSettingRepository.accessibleBy).toHaveBeenCalledWith(expect.anything(), "read");
      expect(walletSettingRepository.findOneByAndLock).toHaveBeenCalledWith({ userId: user.id });
    });

    it("checks the default payment method before opening the transaction", async () => {
      const { user, walletSetting, walletSettingRepository, paymentMethodService, txService, service } = setup();
      walletSettingRepository.findOneByAndLock.mockResolvedValue({ ...walletSetting, autoReloadEnabled: false });
      walletSettingRepository.updateById.mockResolvedValue({ ...walletSetting, autoReloadEnabled: true } as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true });

      expect(paymentMethodService.getDefaultPaymentMethod.mock.invocationCallOrder[0]).toBeLessThan(txService.transaction.mock.invocationCallOrder[0]);
    });

    it("opens no transaction when enabling without a default payment method", async () => {
      const { user, paymentMethodService, txService, service } = setup();
      paymentMethodService.getDefaultPaymentMethod.mockResolvedValue(undefined);

      await expect(service.upsertWalletSetting(user.id, { autoReloadEnabled: true })).rejects.toThrow("Default payment method is required");

      expect(txService.transaction).not.toHaveBeenCalled();
    });
  });

  describe("disableAutoReload", () => {
    it("reports Auto Recharge turned off by Console when the default payment method is removed", async () => {
      const { user, walletSetting, walletSettingRepository, analyticsService, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue({ ...walletSetting, autoReloadEnabled: true });

      await service.disableAutoReload(user.id);

      expect(analyticsService.track).toHaveBeenCalledWith(user.id, "auto_recharge_disabled", {
        disabled_by: "console",
        reason: "default_payment_method_removed"
      });
    });

    it("reports nothing when Auto Recharge was already off", async () => {
      const { user, walletSetting, walletSettingRepository, analyticsService, service } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue({ ...walletSetting, autoReloadEnabled: false });

      await service.disableAutoReload(user.id);

      expect(analyticsService.track).not.toHaveBeenCalled();
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: WalletSettingService.name });
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
    walletSettingRepository.findOneByAndLock.mockResolvedValue(walletSetting);
    const ability = createMongoAbility();
    const authService = mock<AuthService>({
      currentUser: user,
      ability
    });
    const jobId = faker.string.uuid();
    const walletReloadJobService = mock<WalletReloadJobService>({
      scheduleForWalletSetting: vi.fn().mockResolvedValue(jobId)
    });
    const analyticsService = mock<AnalyticsService>();
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new WalletSettingService(
      walletSettingRepository,
      userWalletRepository,
      userRepository,
      paymentMethodService,
      authService,
      walletReloadJobService,
      analyticsService,
      txService,
      createLogger
    );

    return {
      user: userWithStripe,
      userWallet,
      walletSetting,
      walletSettingRepository,
      userWalletRepository,
      paymentMethodService,
      walletReloadJobService,
      analyticsService,
      txService,
      jobId,
      service,
      createLogger
    };
  }
});
