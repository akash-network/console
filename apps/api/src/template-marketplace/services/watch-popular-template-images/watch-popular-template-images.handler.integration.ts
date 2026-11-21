import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";

import { JOB_NAME, JobQueueService } from "@src/core";
import { TEMPLATE_MARKETPLACE_CONFIG, type TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import { ResolveTemplateVersionImageDigestsHandler } from "@src/template-marketplace/services/resolve-template-version-image-digests/resolve-template-version-image-digests.handler";
import {
  ResolveTemplateVersionImageDigests,
  resolveTemplateVersionImageDigestsKeyFor
} from "@src/template-marketplace/services/resolve-template-version-image-digests/resolve-template-version-image-digests.job";
import { WatchPopularTemplateImagesHandler } from "./watch-popular-template-images.handler";
import { nextImageWatchWindowAt, WatchPopularTemplateImages, watchPopularTemplateImagesKeyFor } from "./watch-popular-template-images.job";

import { seedTemplate, seedTemplateDeployers, seedTemplateVersion } from "@test/seeders/db/template.seeder";
import { deleteCompletedJobs, deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const WATCH_JOB = WatchPopularTemplateImages[JOB_NAME];
const DIGEST_JOB = ResolveTemplateVersionImageDigests[JOB_NAME];
const POPULAR_FROM = 2;
const MAX_WATCHED = 2;

const jobWorkers = useJobWorkers(() => [container.resolve(WatchPopularTemplateImagesHandler), container.resolve(ResolveTemplateVersionImageDigestsHandler)]);

describe(WatchPopularTemplateImagesHandler.name, () => {
  it("queues a digest check for the current version of the most deployed popular and Official public templates, up to the limit, and its own next run", async () => {
    const { enqueue, startWorkers, intervalSeconds } = await setup();
    const mostPopular = await seedWatchable(4);
    const official = await seedWatchable(3, { isOfficial: true });
    const overTheLimit = await seedWatchable(2);
    const tooQuiet = await seedWatchable(1);
    const hidden = await seedWatchable(5, { moderationStatus: "hidden" });
    const windowStartsAt = new Date("2026-11-18T06:00:00.000Z");

    await enqueue(new WatchPopularTemplateImages({ windowStartsAt: windowStartsAt.toISOString() }), {
      singletonKey: watchPopularTemplateImagesKeyFor(windowStartsAt)
    });
    await startWorkers();

    await expectJobCompleted(WATCH_JOB, { singletonKey: watchPopularTemplateImagesKeyFor(windowStartsAt) });
    expect(await Promise.all([mostPopular, official, overTheLimit, tooQuiet, hidden].map(({ version }) => countDigestJobsOf(version.id)))).toEqual([
      1, 1, 0, 0, 0
    ]);
    await expectJobCompleted(DIGEST_JOB, { singletonKey: resolveTemplateVersionImageDigestsKeyFor(mostPopular.version.id) });
    const nextWindow = nextImageWatchWindowAt(new Date(), intervalSeconds);
    expect(await findJobRows(WATCH_JOB, { state: "created" })).toMatchObject([
      { singleton_key: watchPopularTemplateImagesKeyFor(nextWindow), data: { windowStartsAt: nextWindow.toISOString(), version: 1 } }
    ]);
  });

  it("seeds one run for the next window however many replicas seed it, due when the window starts", async () => {
    const { handler, intervalSeconds } = await setup();
    await deleteQueuedJobs(WATCH_JOB);
    const now = new Date("2030-01-01T05:10:00.000Z");
    const windowStartsAt = nextImageWatchWindowAt(now, intervalSeconds);

    await Promise.all([handler.seedNextRun(now), handler.seedNextRun(now)]);
    await handler.seedNextRun(new Date(now.getTime() + 60_000));

    const queued = await findJobRows(WATCH_JOB, { singletonKey: watchPopularTemplateImagesKeyFor(windowStartsAt) });
    expect(queued).toMatchObject([{ state: "created", data: { windowStartsAt: windowStartsAt.toISOString() } }]);
    expect(new Date(queued[0].start_after).toISOString()).toBe(windowStartsAt.toISOString());
  });

  it("keeps the workers starting when seeding fails", async () => {
    const { handler } = await setup();
    const enqueue = vi.spyOn(container.resolve(JobQueueService), "enqueue").mockRejectedValueOnce(new Error("queue is down"));

    await expect(handler.seedNextRun(new Date())).resolves.toBeUndefined();

    expect(enqueue).toHaveBeenCalledTimes(1);
    enqueue.mockRestore();
  });

  async function seedWatchable(deployers: number, overrides: Parameters<typeof seedTemplate>[0] = {}) {
    const template = await seedTemplate({ visibility: "public", ...overrides });
    const version = await seedTemplateVersion({ templateId: template.id });
    await seedTemplateDeployers(template.id, deployers);

    return { template, version };
  }

  async function countDigestJobsOf(versionId: string) {
    return (await findJobRows(DIGEST_JOB, { singletonKey: resolveTemplateVersionImageDigestsKeyFor(versionId) })).length;
  }

  async function setup() {
    const config: TemplateMarketplaceConfig = {
      ...container.resolve(TEMPLATE_MARKETPLACE_CONFIG),
      TEMPLATE_POPULAR_WEEKLY_DEPLOYERS: POPULAR_FROM,
      TEMPLATE_IMAGE_WATCH_MAX_TEMPLATES: MAX_WATCHED
    };
    container.registerInstance(TEMPLATE_MARKETPLACE_CONFIG, config);
    const { enqueue, startWorkers } = await jobWorkers();
    await deleteCompletedJobs(WATCH_JOB);

    return {
      handler: container.resolve(WatchPopularTemplateImagesHandler),
      enqueue,
      startWorkers,
      intervalSeconds: config.TEMPLATE_IMAGE_WATCH_INTERVAL_SECONDS
    };
  }
});
