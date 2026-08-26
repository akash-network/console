import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "../../providers/logging.provider";
import { EnqueueOptions, Job, JOB_NAME, JobPayload, JobQueueService } from "../job-queue/job-queue.service";

export { JOB_NAME as DOMAIN_EVENT_NAME };
export interface DomainEvent extends Job {}

export type EventPayload<T extends DomainEvent> = JobPayload<T>;

@singleton()
export class DomainEventsService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueManager: JobQueueService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DomainEventsService.name });
  }

  async publish(event: DomainEvent, options?: EnqueueOptions): Promise<string | null> {
    try {
      return await this.jobQueueManager.enqueue(event, options);
    } catch (error) {
      this.logger.error({
        event: "DOMAIN_EVENT_PUBLISH_FAILED",
        domainEvent: event,
        error
      });

      return null;
    }
  }
}
