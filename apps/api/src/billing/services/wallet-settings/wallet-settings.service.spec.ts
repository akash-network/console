import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { PaymentMethod, PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
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
      walletSettingRepository.findByUserId.mockResolvedValue(disabledSetting);
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
      walletSettingRepository.findByUserId.mockResolvedValue(pausedSetting);
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
      walletSettingRepository.findByUserId.mockResolvedValue(pausedSetting);
      walletSettingRepository.updateById.mockResolvedValue({ ...pausedSetting, autoReloadPausedAt: null } as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: true });

      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(expect.objectContaining({ id: pausedSetting.id }), { withCleanup: true });
    });

    it("leaves the charge window alone when the wallet was never paused", async () => {
      const { user, walletSetting, walletSettingRepository, service } = setup();
      const enabledSetting = { ...walletSetting, autoReloadEnabled: true, autoReloadPausedAt: null };
      walletSettingRepository.findByUserId.mockResolvedValue(enabledSetting);
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
      walletSettingRepository.findByUserId.mockResolvedValue(enabledSetting);
      walletSettingRepository.updateById.mockResolvedValue(disabledSetting as never);

      await service.upsertWalletSetting(user.id, { autoReloadEnabled: false });

      expect(walletReloadJobService.scheduleCreditsLowCheck).toHaveBeenCalledWith(user.id, { withCleanup: true });
      expect(walletReloadJobService.scheduleForWalletSetting).not.toHaveBeenCalled();
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
    const ability = createMongoAbility();
    const authService = mock<AuthService>({
      currentUser: user,
      ability
    });
    const jobId = faker.string.uuid();
    const walletReloadJobService = mock<WalletReloadJobService>({
      scheduleForWalletSetting: vi.fn().mockResolvedValue(jobId)
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new WalletSettingService(
      walletSettingRepository,
      userWalletRepository,
      userRepository,
      paymentMethodService,
      authService,
      walletReloadJobService,
      createLogger
    );

    return {
      user: userWithStripe,
      userWallet,
      walletSetting,
      walletSettingRepository,
      userWalletRepository,
      walletReloadJobService,
      jobId,
      service,
      createLogger
    };
  }
});
