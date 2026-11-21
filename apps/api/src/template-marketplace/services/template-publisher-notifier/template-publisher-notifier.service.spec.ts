import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { NotifyTemplatePublishers } from "@src/template-marketplace/services/notify-template-publishers/notify-template-publishers.job";
import { TemplatePublisherNotifierService } from "./template-publisher-notifier.service";

const RETRY_OPTIONS = { retryLimit: 10, retryBackoff: true, retryDelay: 30, retryDelayMax: 1800 };

describe(TemplatePublisherNotifierService.name, () => {
  it("queues one notice for a moderation event, keyed on the event", async () => {
    const { service, jobQueueService } = setup();

    await service.notifyOfModeration("event-1");

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new NotifyTemplatePublishers({ source: "moderation", eventId: "event-1" }), {
      singletonKey: "notifyTemplatePublishers.moderation.event-1",
      ...RETRY_OPTIONS
    });
  });

  it("queues one notice for a version that failed its checks, naming who saved it", async () => {
    const { service, jobQueueService } = setup();

    await service.notifyVersionFailedChecks({ versionId: "version-1", savedByUserId: "user-1" });

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new NotifyTemplatePublishers({ source: "version_failed_checks", versionId: "version-1", savedByUserId: "user-1" }),
      { singletonKey: "notifyTemplatePublishers.version_failed_checks.version-1", ...RETRY_OPTIONS }
    );
  });

  it("queues one notice for a held version, keyed apart from the notice of its failed checks", async () => {
    const { service, jobQueueService } = setup();

    await service.notifyVersionHeld("version-1");

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new NotifyTemplatePublishers({ source: "version_held", versionId: "version-1" }), {
      singletonKey: "notifyTemplatePublishers.version_held.version-1",
      ...RETRY_OPTIONS
    });
  });

  function setup() {
    const jobQueueService = mock<JobQueueService>();
    const service = new TemplatePublisherNotifierService(jobQueueService);

    return { service, jobQueueService };
  }
});
