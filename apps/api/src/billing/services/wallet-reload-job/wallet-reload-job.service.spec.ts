import { faker } from "@faker-js/faker";
import { mock } from "vitest-mock-extended";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import type { WalletSettingRepository } from "@src/billing/repositories";
import type { JobQueueService } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";
import { WalletReloadJobService } from "./wallet-reload-job.service";

import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletReloadJobService.name, () => {
  describe("scheduleImmediate", () => {
    it("returns early when walletSetting does not exist", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      walletSettingRepository.findByUserId.mockResolvedValue(undefined);

      await service.scheduleImmediate(userId);

      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("returns early when autoReloadEnabled is false", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      const walletSetting = generateWalletSetting({ autoReloadEnabled: false });
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);

      await service.scheduleImmediate(userId);

      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("calls scheduleForWalletSetting when conditions are met", async () => {
      const { service, walletSettingRepository, jobQueueService } = setup();
      const userId = faker.string.uuid();
      const walletSetting = generateWalletSetting({ autoReloadEnabled: true });
      walletSettingRepository.findByUserId.mockResolvedValue(walletSetting);
      const jobId = faker.string.uuid();
      jobQueueService.enqueue.mockResolvedValue(jobId);

      await service.scheduleImmediate(userId);

      expect(walletSettingRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.any(WalletBalanceReloadCheck),
        expect.objectContaining({
          singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`
        })
      );
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

  function setup() {
    const walletSettingRepository = mock<WalletSettingRepository>();
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<LoggerService>();

    const service = new WalletReloadJobService(walletSettingRepository, jobQueueService, logger);

    return {
      service,
      walletSettingRepository,
      jobQueueService,
      logger
    };
  }
});
