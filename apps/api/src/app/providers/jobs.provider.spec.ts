import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { DeleteUnbackedDeploymentSetting } from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { startJobQueues } from "./jobs.provider";

describe("jobs.provider", () => {
  it("registers bringing the queues up as an app initializer", () => {
    const initializers = container.resolveAll(APP_INITIALIZER);

    expect(initializers.map(initializer => initializer[ON_APP_START])).toContain(startJobQueues);
  });

  it("creates a queue for the compensation a deployment create enqueues", async () => {
    const { jobQueue } = setup();

    await startJobQueues();

    const [handlers] = jobQueue.registerHandlers.mock.calls[0];
    expect(handlers.map(handler => handler.accepts)).toContain(DeleteUnbackedDeploymentSetting);
  });

  function setup() {
    const jobQueue = mock<JobQueueService>();
    container.registerInstance(JobQueueService, jobQueue);

    return { jobQueue };
  }
});
