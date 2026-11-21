import { singleton } from "tsyringe";

import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import {
  ResolveTemplateVersionImageDigests,
  resolveTemplateVersionImageDigestsKeyFor
} from "@src/template-marketplace/services/resolve-template-version-image-digests/resolve-template-version-image-digests.job";

@singleton()
export class TemplateImageDigestJobService {
  constructor(private readonly jobQueueService: JobQueueService) {}

  /** Queued in the caller's transaction, so a version that was not saved is never resolved and a registry that is down never holds up a save. */
  async schedule(versionId: string): Promise<void> {
    await this.jobQueueService.enqueue(new ResolveTemplateVersionImageDigests({ versionId }), {
      singletonKey: resolveTemplateVersionImageDigestsKeyFor(versionId)
    });
  }
}
