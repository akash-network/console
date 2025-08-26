import { singleton } from "tsyringe";

import { Job, JOB_NAME, JobQueueService } from "../job-queue/job-queue.service";

export { JOB_NAME as DOMAIN_EVENT_NAME };
export interface DomainEvent extends Job {
  version: number;
}

@singleton()
export class DomainEventsService {
  constructor(private readonly jobQueueManager: JobQueueService) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.jobQueueManager.enqueue(event);
  }
}
