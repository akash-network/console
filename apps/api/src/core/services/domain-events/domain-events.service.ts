import { singleton } from "tsyringe";

import { Job, JOB_NAME, JobPayload, JobQueueService } from "../job-queue/job-queue.service";

export { JOB_NAME as DOMAIN_EVENT_NAME };
export interface DomainEvent extends Job {
  version: number;
}

export type EventPayload<T extends DomainEvent> = JobPayload<T>;

@singleton()
export class DomainEventsService {
  constructor(private readonly jobQueueManager: JobQueueService) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.jobQueueManager.enqueue(event);
  }
}
