import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { JobQueueService } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";
import { WalletReloadJobService } from "./wallet-reload-job.service";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletReloadJobService.name, () => {
  describe("scheduleImmediate", () => {
    it("enqueues a credits-low check when walletSetting does not exist", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      const result = await service.scheduleImmediate({ userId });

      expect(result).toBe(false);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(userId);
      expectCreditsLowCheckScheduled(jobQueueService, userId);
    });

    it("enqueues a credits-low check when autoReloadEnabled is false", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      const walletSetting = generateWalletSetting({ autoReloadEnabled: false, userId });
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      const result = await service.scheduleImmediate({ userId });

      expect(result).toBe(false);
      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(userId);
      expectCreditsLowCheckScheduled(jobQueueService, walletSetting.userId);
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

    it("enqueues a credits-low check by walletId when no wallet setting exists", async () => {
      const { service, walletSettingRepository, userWalletRepository, jobQueueService } = setup();
      const walletId = faker.number.int({ min: 1, max: 1000000 });
      const userWallet = createUserWallet({ id: walletId });
      walletSettingRepository.findOneBy.mockResolvedValue(undefined);
      userWalletRepository.findOneBy.mockResolvedValue(userWallet);
      jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

      const result = await service.scheduleImmediate({ walletId });

      expect(result).toBe(false);
      expect(walletSettingRepository.findOneBy).toHaveBeenCalledWith({ walletId });
      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ id: walletId });
      expectCreditsLowCheckScheduled(jobQueueService, userWallet.userId);
    });

    it("does not throw when a credits-low enqueue collides with an existing singleton", async () => {
      const { service, walletSettingRepository, jobQueueService, logger } = setup();
      const userId = faker.string.uuid();
      walletSettingRepository.findByUserId.mockResolvedValue(generateWalletSetting({ autoReloadEnabled: false, userId }));
      jobQueueService.enqueue.mockResolvedValue(null);

      await expect(service.scheduleImmediate({ userId })).resolves.toBe(false);

      expect(logger.error).not.toHaveBeenCalled();
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

  function setup() {
    const walletSettingRepository = mock<WalletSettingRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<LoggerService>();

    const service = new WalletReloadJobService(walletSettingRepository, userWalletRepository, jobQueueService, logger);

    return {
      service,
      walletSettingRepository,
      userWalletRepository,
      jobQueueService,
      logger
    };
  }
});
