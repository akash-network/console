import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { JobQueueService } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { WalletReloadJobService } from "./wallet-reload-job.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletReloadJobService.name, () => {
  describe("scheduleImmediate", () => {
    it("schedules nothing when walletSetting does not exist", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      const result = await service.scheduleImmediate({ userId });

      expect(result).toBe(false);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(jobQueueService.cancelCreatedBy).not.toHaveBeenCalled();
    });

    it("schedules nothing when autoReloadEnabled is false", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      const walletSetting = generateWalletSetting({ autoReloadEnabled: false, userId });
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);

      const result = await service.scheduleImmediate({ userId });

      expect(result).toBe(false);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(jobQueueService.cancelCreatedBy).not.toHaveBeenCalled();
    });

    it("schedules nothing when the wallet is paused after repeated declines", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      walletSettingRepository.findByUserId.mockResolvedValue(generateWalletSetting({ autoReloadEnabled: true, autoReloadPausedAt: new Date(), userId }));

      const result = await service.scheduleImmediate({ userId });

      expect(result).toBe(false);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("calls scheduleForWalletSetting when conditions are met", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      const walletSetting = generateWalletSetting({ autoReloadEnabled: true });
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
      const jobId = faker.string.uuid();
      jobQueueService.enqueue.mockResolvedValue(jobId);

      const result = await service.scheduleImmediate({ userId });

      expect(result).toBe(true);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({
        name: WalletBalanceReloadCheck.name,
        singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.any(WalletBalanceReloadCheck),
        expect.objectContaining({
          singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`
        })
      );
      const [defaultJob] = jobQueueService.enqueue.mock.calls[0];
      expect((defaultJob as WalletBalanceReloadCheck).data.triggeredByDeployment).toBeUndefined();
    });

    it("marks the job as deployment-triggered only when the caller opts in", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      const walletSetting = generateWalletSetting({ autoReloadEnabled: true });
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleImmediate({ userId }, { triggeredByDeployment: true });

      const [job] = jobQueueService.enqueue.mock.calls[0];
      expect((job as WalletBalanceReloadCheck).data).toMatchObject({ userId: walletSetting.userId, triggeredByDeployment: true });
    });

    it("queues a check inside the charge cooldown for the window reopen instead of running it now", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup({ cooldownMinutes: 60 });
      const lastAutoChargeAt = new Date(Date.now() - 20 * 60_000);
      walletSettingRepository.findByUserId.mockResolvedValue(generateWalletSetting({ autoReloadEnabled: true, lastAutoChargeAt }));
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleImmediate({ userId: faker.string.uuid() });

      const [, options] = jobQueueService.enqueue.mock.calls[0];
      const expectedReopen = new Date(lastAutoChargeAt.getTime() + 61 * 60_000).toISOString();
      expect(options).toMatchObject({ startAfter: expectedReopen });
    });

    it("defers by the backed-off cooldown the wallet's declines have earned", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup({ cooldownMinutes: 60 });
      const lastAutoChargeAt = new Date(Date.now() - 90 * 60_000);
      walletSettingRepository.findByUserId.mockResolvedValue(generateWalletSetting({ autoReloadEnabled: true, lastAutoChargeAt, autoReloadFailureCount: 2 }));
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleImmediate({ userId: faker.string.uuid() });

      const [, options] = jobQueueService.enqueue.mock.calls[0];
      const expectedReopen = new Date(lastAutoChargeAt.getTime() + 121 * 60_000).toISOString();
      expect(options).toMatchObject({ startAfter: expectedReopen });
    });

    it("drops the deployment trigger from a deferred check so it re-checks active deployments when it runs", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup({ cooldownMinutes: 60 });
      const lastAutoChargeAt = new Date(Date.now() - 20 * 60_000);
      walletSettingRepository.findByUserId.mockResolvedValue(generateWalletSetting({ autoReloadEnabled: true, lastAutoChargeAt }));
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleImmediate({ userId: faker.string.uuid() }, { triggeredByDeployment: true });

      const [job, options] = jobQueueService.enqueue.mock.calls[0];
      expect(options).toHaveProperty("startAfter");
      expect((job as WalletBalanceReloadCheck).data.triggeredByDeployment).toBeUndefined();
    });

    it("never defers when the charge cooldown is disabled", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup({ cooldownMinutes: 0 });
      walletSettingRepository.findByUserId.mockResolvedValue(generateWalletSetting({ autoReloadEnabled: true, lastAutoChargeAt: new Date() }));
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleImmediate({ userId: faker.string.uuid() });

      const [, options] = jobQueueService.enqueue.mock.calls[0];
      expect(options).not.toHaveProperty("startAfter");
    });

    it("runs the check right away once the charge cooldown has passed", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup({ cooldownMinutes: 60 });
      const lastAutoChargeAt = new Date(Date.now() - 90 * 60_000);
      walletSettingRepository.findByUserId.mockResolvedValue(generateWalletSetting({ autoReloadEnabled: true, lastAutoChargeAt }));
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleImmediate({ userId: faker.string.uuid() });

      const [, options] = jobQueueService.enqueue.mock.calls[0];
      expect(options).not.toHaveProperty("startAfter");
    });

    it("runs the check right away for a wallet that has never been charged", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      walletSettingRepository.findByUserId.mockResolvedValue(generateWalletSetting({ autoReloadEnabled: true, lastAutoChargeAt: null }));
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleImmediate({ userId: faker.string.uuid() });

      const [, options] = jobQueueService.enqueue.mock.calls[0];
      expect(options).not.toHaveProperty("startAfter");
    });

    it("looks up the wallet setting by walletId when given a walletId", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const walletId = faker.number.int({ min: 1, max: 1000000 });
      const walletSetting = generateWalletSetting({ walletId, autoReloadEnabled: true });
      walletSettingRepository.findOneBy.mockResolvedValue(walletSetting);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      const result = await service.scheduleImmediate({ walletId });

      expect(result).toBe(true);
      expect(walletSettingRepository.findOneBy).toHaveBeenCalledWith({ walletId });
      expect(walletSettingRepository.findByUserId).not.toHaveBeenCalled();
      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({
        name: WalletBalanceReloadCheck.name,
        singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.any(WalletBalanceReloadCheck),
        expect.objectContaining({
          singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`
        })
      );
    });

    it("schedules nothing by walletId when no wallet setting exists", async () => {
      const { service, walletSettingRepository, userWalletRepository, jobQueueService } = setup();
      const walletId = faker.number.int({ min: 1, max: 1000000 });
      walletSettingRepository.findOneBy.mockResolvedValue(undefined);

      const result = await service.scheduleImmediate({ walletId });

      expect(result).toBe(false);
      expect(walletSettingRepository.findOneBy).toHaveBeenCalledWith({ walletId });
      expect(userWalletRepository.findOneBy).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("scheduleForWalletSetting", () => {
    it("creates job successfully without cleanup", async () => {
      const { service, jobQueueService } = setup();
      const walletSetting = generateWalletSetting({
        autoReloadEnabled: true
      });
      const jobId = faker.string.uuid();
      jobQueueService.enqueue.mockResolvedValue(jobId);

      const result = await service.scheduleForWalletSetting(walletSetting);

      expect(jobQueueService.cancelCreatedBy).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.any(WalletBalanceReloadCheck),
        expect.objectContaining({
          singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`
        })
      );
      const [scheduledJob] = jobQueueService.enqueue.mock.calls[0];
      expect((scheduledJob as WalletBalanceReloadCheck).data.triggeredByDeployment).toBeUndefined();
      expect(result).toBe(jobId);
    });

    it("cancels created jobs when withCleanup is true", async () => {
      const { service, jobQueueService } = setup();
      const walletSetting = generateWalletSetting({
        autoReloadEnabled: true
      });
      const jobId = faker.string.uuid();
      jobQueueService.enqueue.mockResolvedValue(jobId);

      await service.scheduleForWalletSetting(walletSetting, { withCleanup: true });

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({
        name: WalletBalanceReloadCheck.name,
        singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.any(WalletBalanceReloadCheck),
        expect.objectContaining({
          singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`
        })
      );
    });

    it("handles startAfter option", async () => {
      const { service, jobQueueService } = setup();
      const walletSetting = generateWalletSetting({
        autoReloadEnabled: true
      });
      const jobId = faker.string.uuid();
      const startAfter = new Date();
      jobQueueService.enqueue.mockResolvedValue(jobId);

      await service.scheduleForWalletSetting(walletSetting, { startAfter });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.any(WalletBalanceReloadCheck),
        expect.objectContaining({
          singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`,
          startAfter
        })
      );
    });

    it("handles both withCleanup and startAfter options", async () => {
      const { service, jobQueueService } = setup();
      const walletSetting = generateWalletSetting({
        autoReloadEnabled: true
      });
      const jobId = faker.string.uuid();
      const startAfter = new Date();
      jobQueueService.enqueue.mockResolvedValue(jobId);

      await service.scheduleForWalletSetting(walletSetting, { withCleanup: true, startAfter });

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({
        name: WalletBalanceReloadCheck.name,
        singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.any(WalletBalanceReloadCheck),
        expect.objectContaining({
          singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`,
          startAfter
        })
      );
    });

    it("throws error when job creation fails", async () => {
      const { service, jobQueueService, logger } = setup();
      const walletSetting = generateWalletSetting({
        autoReloadEnabled: true
      });
      jobQueueService.enqueue.mockResolvedValue(null);

      await expect(service.scheduleForWalletSetting(walletSetting)).rejects.toThrow("Failed to schedule wallet balance reload check");

      expect(logger.error).toHaveBeenCalledWith({
        event: "JOB_CREATION_FAILED",
        userId: walletSetting.userId
      });
    });
  });

  describe("scheduleCreditsLowCheckIfAutoReloadOff", () => {
    it("does not enqueue a reload job when autoReloadEnabled is true", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const walletId = faker.number.int({ min: 1, max: 1000000 });
      const walletSetting = generateWalletSetting({ walletId, autoReloadEnabled: true });
      walletSettingRepository.findOneBy.mockResolvedValue(walletSetting);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleCreditsLowCheckIfAutoReloadOff({ walletId });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(jobQueueService.cancelCreatedBy).not.toHaveBeenCalled();
    });

    it("enqueues a credits-low check when autoReloadEnabled is false", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const walletId = faker.number.int({ min: 1, max: 1000000 });
      const walletSetting = generateWalletSetting({ walletId, autoReloadEnabled: false });
      walletSettingRepository.findOneBy.mockResolvedValue(walletSetting);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleCreditsLowCheckIfAutoReloadOff({ walletId });

      expectCreditsLowCheckScheduled(jobQueueService, walletSetting.userId);
      expect(jobQueueService.enqueue).not.toHaveBeenCalledWith(expect.any(WalletBalanceReloadCheck), expect.anything());
    });

    it("enqueues a credits-low check when the wallet is paused after repeated declines", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const walletId = faker.number.int({ min: 1, max: 1000000 });
      const walletSetting = generateWalletSetting({ walletId, autoReloadEnabled: true, autoReloadPausedAt: new Date() });
      walletSettingRepository.findOneBy.mockResolvedValue(walletSetting);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleCreditsLowCheckIfAutoReloadOff({ walletId });

      expectCreditsLowCheckScheduled(jobQueueService, walletSetting.userId);
    });

    it("enqueues a credits-low check when wallet setting does not exist", async () => {
      const { service, walletSettingRepository, userWalletRepository, jobQueueService } = setup();
      const walletId = faker.number.int({ min: 1, max: 1000000 });
      const userWallet = createUserWallet({ id: walletId });
      walletSettingRepository.findOneBy.mockResolvedValue(undefined);
      userWalletRepository.findOneBy.mockResolvedValue(userWallet);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      await service.scheduleCreditsLowCheckIfAutoReloadOff({ walletId });

      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ id: walletId });
      expectCreditsLowCheckScheduled(jobQueueService, userWallet.userId);
      expect(jobQueueService.enqueue).not.toHaveBeenCalledWith(expect.any(WalletBalanceReloadCheck), expect.anything());
    });
  });

  describe("scheduleCreditsLowCheck", () => {
    it("returns successfully when enqueue returns null", async () => {
      const { service, jobQueueService, logger } = setup();
      const userId = faker.string.uuid();
      jobQueueService.enqueue.mockResolvedValue(null);

      await expect(service.scheduleCreditsLowCheck(userId)).resolves.toBeNull();

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({
        event: "CREDITS_LOW_CHECK_ALREADY_QUEUED",
        userId
      });
    });

    it("logs and returns null when the enqueue throws", async () => {
      const { service, jobQueueService, logger } = setup();
      const userId = faker.string.uuid();
      const error = new Error("Queue cache is not initialized");
      jobQueueService.enqueue.mockRejectedValue(error);

      await expect(service.scheduleCreditsLowCheck(userId)).resolves.toBeNull();

      expect(logger.error).toHaveBeenCalledWith({
        event: "CREDITS_LOW_CHECK_SCHEDULE_FAILED",
        userId,
        error
      });
    });

    it("logs and returns null when the cleanup throws", async () => {
      const { service, jobQueueService, logger } = setup();
      const userId = faker.string.uuid();
      const error = new Error("Database not opened. Call open() before executing SQL.");
      jobQueueService.cancelCreatedBy.mockRejectedValue(error);

      await expect(service.scheduleCreditsLowCheck(userId, { withCleanup: true })).resolves.toBeNull();

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith({
        event: "CREDITS_LOW_CHECK_SCHEDULE_FAILED",
        userId,
        error
      });
    });
  });

  describe("cancelCreatedByUserId", () => {
    it("cancels created jobs for user with correct parameters", async () => {
      const { service, jobQueueService } = setup();
      const userId = faker.string.uuid();

      await service.cancelCreatedByUserId(userId);

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({
        name: WalletBalanceReloadCheck.name,
        singletonKey: `${WalletBalanceReloadCheck.name}.${userId}`
      });
    });
  });

  function expectCreditsLowCheckScheduled(jobQueueService: ReturnType<typeof mock<JobQueueService>>, userId: string) {
    expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({
      name: WalletCreditsLowCheck.name,
      singletonKey: `${WalletCreditsLowCheck.name}.${userId}`
    });
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      expect.any(WalletCreditsLowCheck),
      expect.objectContaining({
        singletonKey: `${WalletCreditsLowCheck.name}.${userId}`
      })
    );
    const [job] = jobQueueService.enqueue.mock.calls[0];
    expect((job as WalletCreditsLowCheck).data).toEqual({ userId });
  }

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: WalletReloadJobService.name });
  });

  function setup(input?: { cooldownMinutes?: number }) {
    const walletSettingRepository = mock<WalletSettingRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const jobQueueService = mock<JobQueueService>();
    const billingConfig = mockConfigService<BillingConfigService>({
      AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN: input?.cooldownMinutes ?? 60,
      AUTO_RELOAD_CHARGE_BACKOFF_MAX_IN_MIN: 1440
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new WalletReloadJobService(walletSettingRepository, userWalletRepository, jobQueueService, billingConfig, createLogger);

    return {
      service,
      walletSettingRepository,
      userWalletRepository,
      jobQueueService,
      logger,
      createLogger
    };
  }
});
