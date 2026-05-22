import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { JobQueueService, PgBossJobState } from "../job-queue/job-queue.service";
import type { TimerService } from "../timer/timer.service";
import type { DomainEvent } from "./domain-events.service";
import { DomainEventsService } from "./domain-events.service";

describe(DomainEventsService.name, () => {
  describe("publish()", () => {
    it("enqueues the event successfully", async () => {
      const { service, jobQueueManager } = setup();
      const event = createTestEvent();
      jobQueueManager.enqueue.mockResolvedValue("12345");

      const result = await service.publish(event);

      expect(result).toBe("12345");
      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(event, undefined);
    });

    it("returns null and logs when enqueue throws", async () => {
      const { service, jobQueueManager, logger } = setup();
      const event = createTestEvent();
      const error = new Error("boom");
      jobQueueManager.enqueue.mockRejectedValue(error);

      const result = await service.publish(event);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith({
        event: "DOMAIN_EVENT_PUBLISH_FAILED",
        domainEvent: event,
        error
      });
    });
  });

  describe("publishAndAwait()", () => {
    it("returns 'completed' when the job's state flips to completed before timeout", async () => {
      const { service, jobQueueManager } = setup();
      const event = createTestEvent();
      const output = { ok: true };
      jobQueueManager.enqueue.mockResolvedValue("job-1");
      jobQueueManager.getJobState.mockResolvedValueOnce({ state: "active", output: {} }).mockResolvedValueOnce({ state: "completed", output });

      const result = await service.publishAndAwait(event, { timeoutMs: 1_000, pollIntervalMs: 10 });

      expect(result).toEqual({ status: "completed", jobId: "job-1", output });
      expect(jobQueueManager.getJobState).toHaveBeenCalledWith("testEvent", "job-1");
    });

    it.each([["failed"], ["cancelled"], ["expired"]] as const)("returns 'failed' when the job's state is %s (terminal failure)", async stateName => {
      const { service, jobQueueManager } = setup();
      const event = createTestEvent();
      jobQueueManager.enqueue.mockResolvedValue("job-2");
      jobQueueManager.getJobState.mockResolvedValue({
        state: stateName as PgBossJobState,
        output: { reason: "x" }
      });

      const result = await service.publishAndAwait(event, { timeoutMs: 1_000, pollIntervalMs: 10 });

      expect(result).toEqual({ status: "failed", jobId: "job-2", output: { reason: "x" } });
    });

    it("returns 'timeout' and logs JOB_AWAIT_TIMEOUT when state stays non-terminal past timeoutMs", async () => {
      const nowSpy = vi.spyOn(Date, "now");
      let current = 0;
      nowSpy.mockImplementation(() => current);

      const { service, jobQueueManager, timer, logger } = setup();
      const event = createTestEvent();
      jobQueueManager.enqueue.mockResolvedValue("job-3");
      jobQueueManager.getJobState.mockResolvedValue({ state: "active", output: {} });
      timer.delay.mockImplementation(async (ms: number) => {
        current += ms;
      });

      const result = await service.publishAndAwait(event, { timeoutMs: 100, pollIntervalMs: 50 });

      expect(result).toEqual({ status: "timeout", jobId: "job-3" });
      expect(logger.warn).toHaveBeenCalledWith({
        event: "JOB_AWAIT_TIMEOUT",
        jobId: "job-3",
        name: "testEvent",
        timeoutMs: 100
      });
      expect(jobQueueManager.cancel).not.toHaveBeenCalled();

      nowSpy.mockRestore();
    });

    it("uses default 250ms poll interval when pollIntervalMs is not provided", async () => {
      const { service, jobQueueManager, timer } = setup();
      const event = createTestEvent();
      jobQueueManager.enqueue.mockResolvedValue("job-4");
      jobQueueManager.getJobState.mockResolvedValueOnce({ state: "active", output: {} }).mockResolvedValueOnce({ state: "completed", output: {} });

      await service.publishAndAwait(event, { timeoutMs: 5_000 });

      expect(timer.delay).toHaveBeenCalledWith(250);
    });

    it("returns { status: 'failed', jobId: '' } when publish fails to enqueue", async () => {
      const { service, jobQueueManager } = setup();
      const event = createTestEvent();
      jobQueueManager.enqueue.mockRejectedValue(new Error("db down"));

      const result = await service.publishAndAwait(event, { timeoutMs: 1_000, pollIntervalMs: 10 });

      expect(result).toEqual({ status: "failed", jobId: "" });
      expect(jobQueueManager.getJobState).not.toHaveBeenCalled();
      expect(jobQueueManager.cancel).not.toHaveBeenCalled();
    });

    it("treats a null state snapshot (job not found yet) as non-terminal and keeps polling", async () => {
      const { service, jobQueueManager, timer } = setup();
      const event = createTestEvent();
      jobQueueManager.enqueue.mockResolvedValue("job-5");
      jobQueueManager.getJobState.mockResolvedValueOnce(null).mockResolvedValueOnce({ state: "completed", output: {} });

      const result = await service.publishAndAwait(event, { timeoutMs: 1_000, pollIntervalMs: 10 });

      expect(result.status).toBe("completed");
      expect(timer.delay).toHaveBeenCalledTimes(1);
      expect(timer.delay).toHaveBeenCalledWith(10);
    });
  });

  function setup() {
    const jobQueueManager = mock<JobQueueService>();
    const logger = mock<LoggerService>();
    const timer = mock<TimerService>({
      delay: vi.fn().mockResolvedValue(undefined)
    });
    const service = new DomainEventsService(jobQueueManager, logger, timer);
    return { service, jobQueueManager, logger, timer };
  }

  function createTestEvent(): DomainEvent {
    return { version: 1, name: "testEvent", data: { key: "value" } };
  }
});
