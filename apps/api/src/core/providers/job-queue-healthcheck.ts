import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

import { JobQueueService } from "../services/job-queue/job-queue.service";

export type JobQueueHealthcheck = {
  ping(): Promise<void>;
};
export const JOB_QUEUE_HEALTHCHECK: InjectionToken<JobQueueHealthcheck> = "JOB_QUEUE_HEALTHCHECK";
container.register(JOB_QUEUE_HEALTHCHECK, {
  useFactory: c => {
    const jobQueueService = c.resolve(JobQueueService);
    return {
      ping: () => jobQueueService.ping()
    };
  }
});
