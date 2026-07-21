import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "../job-queue/job-queue.service";
import type { DomainEvent } from "./domain-events.service";
import { DomainEventsService } from "./domain-events.service";

describe(DomainEventsService.name, () => {
  describe("publish()", () => {
    it("publishes the event to the job queue", async () => {
      class TestEvent implements DomainEvent {
        version = 1;
        name = "testEvent";
        data = { key: "value" };
      }

      const { service, jobQueueManager } = setup();
      const event = new TestEvent();
      const options = { singletonKey: "key" };

      await service.publish(event, options);

      expect(jobQueueManager.publish).toHaveBeenCalledWith(event, options);
    });

    it("logs and swallows errors when publishing fails", async () => {
      class TestEvent implements DomainEvent {
        version = 1;
        name = "testEvent";
        data = { key: "value" };
      }

      const { service, jobQueueManager, logger } = setup();
      const event = new TestEvent();
      const error = new Error("boom");
      jobQueueManager.publish.mockRejectedValue(error);

      await expect(service.publish(event)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({
        event: "DOMAIN_EVENT_PUBLISH_FAILED",
        domainEvent: event,
        error
      });
    });
  });

  function setup() {
    const jobQueueManager = mock<JobQueueService>();
    const logger = mock<LoggerService>();
    const service = new DomainEventsService(jobQueueManager, logger);
    return { service, jobQueueManager, logger };
  }
});
