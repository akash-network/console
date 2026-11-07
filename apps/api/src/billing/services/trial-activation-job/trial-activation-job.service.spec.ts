import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ActivateTrial } from "@src/billing/events/activate-trial";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { AccountStatus } from "@src/user/lib/account-status/account-status";
import type { UserRepository } from "@src/user/repositories";
import type { AccountStatusService } from "@src/user/services/account-status/account-status.service";
import { AccountStatusGuard } from "@src/user/services/account-status-guard/account-status-guard.service";
import { TrialActivationJobService } from "./trial-activation-job.service";

import { createUser } from "@test/seeders/user.seeder";

describe(TrialActivationJobService.name, () => {
  describe("schedule", () => {
    it("enqueues an ActivateTrial job deduplicated per user", async () => {
      const { service, jobQueueService } = setup();
      const userId = faker.string.uuid();

      await service.schedule(userId);

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(ActivateTrial), { singletonKey: `${ActivateTrial.name}.${userId}` });
    });
  });

  describe("assertActivated", () => {
    it("returns without scheduling when the wallet is already activated", async () => {
      const { service, jobQueueService } = setup();

      await service.assertActivated({ userId: faker.string.uuid(), activatedAt: new Date() });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("schedules activation and throws a retriable 409 when the wallet is not activated", async () => {
      const { service, jobQueueService } = setup();
      const userId = faker.string.uuid();

      await expect(service.assertActivated({ userId, activatedAt: null })).rejects.toMatchObject({ status: 409, errorCode: "wallet_provisioning" });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(ActivateTrial), { singletonKey: `${ActivateTrial.name}.${userId}` });
    });

    it("refuses a suspended user with account_suspended instead of requesting a trial", async () => {
      const { service, jobQueueService, userRepository } = setup({ accountStatus: "suspended" });
      const userId = faker.string.uuid();

      await expect(service.assertActivated({ userId, activatedAt: null })).rejects.toMatchObject({ status: 403, errorCode: "account_suspended" });
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: userId });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("still throws the 409 and logs when the re-enqueue fails", async () => {
      const enqueueError = new Error("queue unavailable");
      const { service, logger } = setup({ enqueueError });
      const userId = faker.string.uuid();

      await expect(service.assertActivated({ userId, activatedAt: null })).rejects.toMatchObject({ status: 409, errorCode: "wallet_provisioning" });
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FAILED_TO_SCHEDULE_TRIAL_ACTIVATION", userId, error: enqueueError }));
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: TrialActivationJobService.name });
  });

  function setup(input?: { enqueueError?: Error; accountStatus?: AccountStatus }) {
    const jobQueueService = mock<JobQueueService>();
    if (input?.enqueueError) {
      jobQueueService.enqueue.mockRejectedValue(input.enqueueError);
    }
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const userRepository = mock<UserRepository>({ findOneBy: vi.fn().mockResolvedValue(createUser({ accountStatus: input?.accountStatus ?? "active" })) });
    const accountStatusGuard = new AccountStatusGuard(userRepository, mock<AccountStatusService>({ findUserReasonOf: vi.fn().mockResolvedValue(null) }));
    const service = new TrialActivationJobService(jobQueueService, accountStatusGuard, createLogger);
    return { service, jobQueueService, logger, createLogger, userRepository };
  }
});
