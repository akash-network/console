import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "../job-queue/job-queue.service";
import type { DomainEvent } from "./domain-events.service";
import { DomainEventsService } from "./domain-events.service";

describe(DomainEventsService.name, () => {
  describe("publish()", () => {
    it("enqueues the event successfully", async () => {
      class TestEvent implements DomainEvent {
        version = 1;
        name = "testEvent";
        data = { key: "value" };
      }

      const { service, jobQueueManager } = setup();
      const event = new TestEvent();
      const jobId = "12345";
      jobQueueManager.enqueue.mockResolvedValue(jobId);

      const result = await service.publish(event);

      expect(result).toBe(jobId);
      expect(jobQueueManager.enqueue).toHaveBeenCalledWith(event, undefined);
    });
  });

  function setup() {
    const jobQueueManager = mock<JobQueueService>();
    const logger = mock<LoggerService>();
    const service = new DomainEventsService(jobQueueManager, logger);
    return { service, jobQueueManager, logger };
  }
});
