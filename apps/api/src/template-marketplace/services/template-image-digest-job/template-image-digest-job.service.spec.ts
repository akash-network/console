import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import {
  ResolveTemplateVersionImageDigests,
  resolveTemplateVersionImageDigestsKeyFor
} from "@src/template-marketplace/services/resolve-template-version-image-digests/resolve-template-version-image-digests.job";
import { TemplateImageDigestJobService } from "./template-image-digest-job.service";

describe(TemplateImageDigestJobService.name, () => {
  it("queues one resolution per version, keyed by the version", async () => {
    const { service, jobQueueService } = setup();
    const versionId = faker.string.uuid();

    await service.schedule(versionId);

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    const [job, options] = jobQueueService.enqueue.mock.calls[0];
    expect(job).toBeInstanceOf(ResolveTemplateVersionImageDigests);
    expect(job).toMatchObject({ name: "ResolveTemplateVersionImageDigests", version: 1, data: { versionId } });
    expect(options).toEqual({ singletonKey: `resolveTemplateVersionImageDigests.${versionId}` });
    expect(resolveTemplateVersionImageDigestsKeyFor(versionId)).toBe(`resolveTemplateVersionImageDigests.${versionId}`);
  });

  function setup() {
    const jobQueueService = mock<JobQueueService>();
    const service = new TemplateImageDigestJobService(jobQueueService);

    return { service, jobQueueService };
  }
});
