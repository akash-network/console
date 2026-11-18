import { singleton } from "tsyringe";

import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import {
  NOTIFY_TEMPLATE_PUBLISHERS_RETRY_OPTIONS,
  NotifyTemplatePublishers,
  notifyTemplatePublishersKeyFor,
  type TemplatePublisherNoticeSource
} from "@src/template-marketplace/services/notify-template-publishers/notify-template-publishers.job";

/** Each notice is queued in the caller's transaction, so it goes out only if what it tells about was committed. */
@singleton()
export class TemplatePublisherNotifierService {
  constructor(private readonly jobQueueService: JobQueueService) {}

  async notifyOfModeration(eventId: string): Promise<void> {
    await this.#enqueue({ source: "moderation", eventId });
  }

  /** Whoever saved the version saw the result in the editor, so the notice goes to everyone else it concerns. */
  async notifyVersionFailedChecks({ versionId, savedByUserId }: { versionId: string; savedByUserId: string }): Promise<void> {
    await this.#enqueue({ source: "version_failed_checks", versionId, savedByUserId });
  }

  async notifyVersionHeld(versionId: string): Promise<void> {
    await this.#enqueue({ source: "version_held", versionId });
  }

  async #enqueue(notice: TemplatePublisherNoticeSource): Promise<void> {
    await this.jobQueueService.enqueue(new NotifyTemplatePublishers(notice), {
      singletonKey: notifyTemplatePublishersKeyFor(notice),
      ...NOTIFY_TEMPLATE_PUBLISHERS_RETRY_OPTIONS
    });
  }
}
