import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ActivateTrial } from "@src/billing/events/activate-trial";
import type { TrialEligibilityService } from "@src/billing/services/trial-eligibility/trial-eligibility.service";
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

    it("answers a refused trial with its refusal instead of a retriable 409, and requests no activation", async () => {
      const refusal = createError(400, "Unable to start trial. Please contact support for assistance.");
      const { service, jobQueueService, trialEligibilityService } = setup({ eligibilityError: refusal });
      const userId = faker.string.uuid();

      await expect(service.assertActivated({ userId, activatedAt: null })).rejects.toBe(refusal);
      expect(trialEligibilityService.assertEligible).toHaveBeenCalledWith(userId);
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("refuses a suspended user before asking whether the trial is refused", async () => {
      const { service, trialEligibilityService } = setup({ accountStatus: "suspended" });

      await expect(service.assertActivated({ userId: faker.string.uuid(), activatedAt: null })).rejects.toMatchObject({ status: 403 });
      expect(trialEligibilityService.assertEligible).not.toHaveBeenCalled();
    });

    it("does not ask whether the trial is refused once the wallet is activated", async () => {
      const { service, trialEligibilityService } = setup();

      await service.assertActivated({ userId: faker.string.uuid(), activatedAt: new Date() });

      expect(trialEligibilityService.assertEligible).not.toHaveBeenCalled();
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

  function setup(input?: { enqueueError?: Error; accountStatus?: AccountStatus; eligibilityError?: Error }) {
    const jobQueueService = mock<JobQueueService>();
    if (input?.enqueueError) {
      jobQueueService.enqueue.mockRejectedValue(input.enqueueError);
    }
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const userRepository = mock<UserRepository>({ findOneBy: vi.fn().mockResolvedValue(createUser({ accountStatus: input?.accountStatus ?? "active" })) });
    const accountStatusGuard = new AccountStatusGuard(userRepository, mock<AccountStatusService>({ findUserReasonOf: vi.fn().mockResolvedValue(null) }));
    const trialEligibilityService = mock<TrialEligibilityService>({
      assertEligible: input?.eligibilityError ? vi.fn().mockRejectedValue(input.eligibilityError) : vi.fn().mockResolvedValue(undefined)
    });
    const service = new TrialActivationJobService(jobQueueService, accountStatusGuard, trialEligibilityService, createLogger);
    return { service, jobQueueService, logger, createLogger, userRepository, trialEligibilityService };
  }
});
