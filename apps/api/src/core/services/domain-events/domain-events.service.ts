import { singleton } from "tsyringe";

import { LoggerService } from "../../providers/logging.provider";
import { Job, JOB_NAME, JobPayload, JobQueueService } from "../job-queue/job-queue.service";

export { JOB_NAME as DOMAIN_EVENT_NAME };
export interface DomainEvent extends Job {
  version: number;
}

export type EventPayload<T extends DomainEvent> = JobPayload<T>;

@singleton()
export class DomainEventsService {
  constructor(
    private readonly jobQueueManager: JobQueueService,
    private readonly logger: LoggerService
  ) {}

  async publish(event: DomainEvent): Promise<void> {
    try {
      await this.jobQueueManager.enqueue(event);
    } catch (error) {
      this.logger.error({
        event: "DOMAIN_EVENT_PUBLISH_FAILED",
        domainEvent: event,
        error
      });
    }
  }
}
