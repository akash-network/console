import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "../../providers/logging.provider";
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

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: DomainEventsService.name });
  });

  function setup() {
    const jobQueueManager = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new DomainEventsService(jobQueueManager, createLogger);
    return { service, jobQueueManager, logger, createLogger };
  }
});
