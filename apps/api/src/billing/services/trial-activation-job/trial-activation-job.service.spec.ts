import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { ActivateTrial } from "@src/billing/events/activate-trial";
import type { JobQueueService, LoggerService } from "@src/core";
import { TrialActivationJobService } from "./trial-activation-job.service";

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

    it("still throws the 409 and logs when the re-enqueue fails", async () => {
      const enqueueError = new Error("queue unavailable");
      const { service, logger } = setup({ enqueueError });
      const userId = faker.string.uuid();

      await expect(service.assertActivated({ userId, activatedAt: null })).rejects.toMatchObject({ status: 409, errorCode: "wallet_provisioning" });
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FAILED_TO_SCHEDULE_TRIAL_ACTIVATION", userId, error: enqueueError }));
    });
  });

  function setup(input?: { enqueueError?: Error }) {
    const jobQueueService = mock<JobQueueService>();
    if (input?.enqueueError) {
      jobQueueService.enqueue.mockRejectedValue(input.enqueueError);
    }
    const logger = mock<LoggerService>();
    const service = new TrialActivationJobService(jobQueueService, logger);
    return { service, jobQueueService, logger };
  }
});
