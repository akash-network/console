import { faker } from "@faker-js/faker";
import { hoursToMilliseconds } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService } from "@src/core";
import { JOB_NAME } from "@src/core";
import { CloseExpiredDeploymentCommand } from "@src/deployment/commands/close-expired-deployment.command";
import type { DeploymentSettingRepository, ExpiredRuntimeDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentCloseJobService } from "./deployment-close-job.service";

describe(DeploymentCloseJobService.name, () => {
  describe("schedule", () => {
    it("enqueues a close job keyed on the deployment setting and dated at the deadline", async () => {
      const { service, jobQueueService } = setup();
      const target = createTarget();
      const startAfter = hoursFromNow(3);

      await service.schedule(target, { startAfter });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: target }), {
        singletonKey: `${CloseExpiredDeploymentCommand[JOB_NAME]}.${target.deploymentSettingId}`,
        startAfter: startAfter.toISOString()
      });
    });

    it("cancels the deployment's pending job before enqueueing when asked to clean up", async () => {
      const { service, jobQueueService } = setup();
      const target = createTarget();

      await service.schedule(target, { startAfter: hoursFromNow(3), withCleanup: true });

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({
        name: CloseExpiredDeploymentCommand[JOB_NAME],
        singletonKey: `${CloseExpiredDeploymentCommand[JOB_NAME]}.${target.deploymentSettingId}`
      });
      expect(jobQueueService.cancelCreatedBy.mock.invocationCallOrder[0]).toBeLessThan(jobQueueService.enqueue.mock.invocationCallOrder[0]);
    });

    it("leaves a pending job alone when not asked to clean up", async () => {
      const { service, jobQueueService } = setup();

      await service.schedule(createTarget(), { startAfter: hoursFromNow(3) });

      expect(jobQueueService.cancelCreatedBy).not.toHaveBeenCalled();
    });

    it("clamps a deadline already in the past to now so retention cannot reap the job", async () => {
      const { service, jobQueueService } = setup();
      const now = new Date("2026-08-26T12:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(now);

      await service.schedule(createTarget(), { startAfter: new Date("2026-01-01T00:00:00.000Z") });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ startAfter: now.toISOString() }));

      vi.useRealTimers();
    });

    it("throws when the queue does not report a created job", async () => {
      const { service, jobQueueService } = setup();
      jobQueueService.enqueue.mockResolvedValue(null);

      await expect(service.schedule(createTarget(), { startAfter: hoursFromNow(3) })).rejects.toThrow("Failed to schedule expired deployment close");
    });
  });

  describe("cancel", () => {
    it("cancels the deployment's pending job", async () => {
      const { service, jobQueueService } = setup();
      const deploymentSettingId = faker.string.uuid();

      await service.cancel(deploymentSettingId);

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({
        name: CloseExpiredDeploymentCommand[JOB_NAME],
        singletonKey: `${CloseExpiredDeploymentCommand[JOB_NAME]}.${deploymentSettingId}`
      });
    });
  });

  describe("reconcileExpired", () => {
    it("schedules a close job for every deployment already past its deadline", async () => {
      const expired = [createExpiredRuntimeDeployment(), createExpiredRuntimeDeployment()];
      const { service, jobQueueService } = setup({ expired });

      await service.reconcileExpired({ dryRun: false });

      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ data: { deploymentSettingId: expired[0].id, userId: expired[0].userId, dseq: expired[0].dseq } }),
        expect.objectContaining({ singletonKey: `${CloseExpiredDeploymentCommand[JOB_NAME]}.${expired[0].id}` })
      );
    });

    it("keeps reconciling the rest when one deployment fails to schedule", async () => {
      const expired = [createExpiredRuntimeDeployment(), createExpiredRuntimeDeployment()];
      const { service, jobQueueService } = setup({ expired });
      jobQueueService.enqueue.mockResolvedValueOnce(null);

      await expect(service.reconcileExpired({ dryRun: false })).resolves.toBeUndefined();

      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
    });

    it("schedules nothing on a dry run", async () => {
      const { service, jobQueueService } = setup({ expired: [createExpiredRuntimeDeployment()] });

      await service.reconcileExpired({ dryRun: true });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(jobQueueService.cancelCreatedBy).not.toHaveBeenCalled();
    });
  });

  function hoursFromNow(hours: number) {
    return new Date(Date.now() + hoursToMilliseconds(hours));
  }

  function createTarget() {
    return { deploymentSettingId: faker.string.uuid(), userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
  }

  function createExpiredRuntimeDeployment(): ExpiredRuntimeDeployment {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      dseq: faker.string.numeric(6),
      runtimeEndsAt: new Date(Date.now() - hoursToMilliseconds(1))
    };
  }

  function setup(input: { expired?: ExpiredRuntimeDeployment[] } = {}) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    deploymentSettingRepository.findExpiredRuntimeDeployments.mockResolvedValue(input.expired ?? []);
    jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());

    const service = new DeploymentCloseJobService(deploymentSettingRepository, jobQueueService, createLogger);

    return { service, deploymentSettingRepository, jobQueueService, logger, createLogger };
  }
});
