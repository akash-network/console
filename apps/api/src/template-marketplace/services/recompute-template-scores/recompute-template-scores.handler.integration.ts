import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";

import { type ApiPgDatabase, JOB_NAME, JobQueueService, POSTGRES_DB, resolveTable } from "@src/core";
import { TEMPLATE_MARKETPLACE_CONFIG, type TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import { RecomputeTemplateScoresHandler, scoringSettingsOf } from "./recompute-template-scores.handler";
import { nextScoreWindowAt, RecomputeTemplateScores, recomputeTemplateScoresKeyFor } from "./recompute-template-scores.job";

import { findStoredTemplateScores, seedTemplate, seedTemplateScore, seedTemplateUsageEvent } from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { deleteCompletedJobs, deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SCORE_JOB = RecomputeTemplateScores[JOB_NAME];
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const jobWorkers = useJobWorkers(() => [container.resolve(RecomputeTemplateScoresHandler)]);

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS - HOUR_MS);
}

function stillRunning(templateRef: string, overrides: Partial<Parameters<typeof seedTemplateUsageEvent>[0]> = {}) {
  return seedTemplateUsageEvent({ templateRef, action: "still_running_24h", createdAt: daysAgo(0), ...overrides });
}

describe(RecomputeTemplateScoresHandler.name, () => {
  it("scores every template with counted usage, with the numbers behind each score, and queues its own next run", async () => {
    const { runRecompute, intervalSeconds } = await setup();
    const rising = await seedTemplate({ visibility: "public" });
    const fading = await seedTemplate({ visibility: "public" });
    const repeatUser = await seedUser();
    await Promise.all([
      stillRunning(rising.id, { userId: repeatUser.id }),
      stillRunning(rising.id, { userId: repeatUser.id }),
      stillRunning(rising.id),
      stillRunning(rising.id, { isTrial: true }),
      stillRunning(rising.id, { isTrial: true }),
      stillRunning(rising.id, { createdAt: daysAgo(7) }),
      stillRunning(rising.id, { organizationId: rising.organizationId }),
      stillRunning(rising.id, { network: "sandbox" }),
      seedTemplateUsageEvent({ templateRef: rising.id, action: "deploy", createdAt: daysAgo(1) }),
      seedTemplateUsageEvent({ templateRef: rising.id, action: "deploy", createdAt: daysAgo(2) }),
      stillRunning(fading.id, { createdAt: daysAgo(8) }),
      stillRunning(fading.id, { createdAt: daysAgo(8) }),
      stillRunning(fading.id, { createdAt: daysAgo(9) }),
      stillRunning("akash-network-awesome-akash-ollama", { source: "awesome_akash", createdAt: daysAgo(30) })
    ]);

    const startedAt = new Date();
    await runRecompute();

    expect((await findStoredTemplateScores()).sort(byTemplateRef)).toEqual(
      [
        {
          source: "console",
          templateRef: rising.id,
          popularScore: 3.3507,
          trendingScore: 0.75,
          weeklyDeployers: 2,
          isTrending: true,
          breakdown: {
            version: 1,
            popular: { windowDays: 180, halfLifeDays: 30, trialWeight: 0.25, paid: 3, trial: 2, decayedPaid: 2.8507, decayedTrial: 2 },
            trending: {
              windowDays: 7,
              minVolume: 2,
              trialWeight: 0.25,
              current: { paid: 2, trial: 2, weighted: 2.5 },
              previous: { paid: 1, trial: 0, weighted: 1 },
              meetsMinVolume: true
            },
            weeklyDeployers: 2
          },
          computedAt: expect.any(Date)
        },
        {
          source: "console",
          templateRef: fading.id,
          popularScore: 2.4747,
          trendingScore: -1,
          weeklyDeployers: 0,
          isTrending: false,
          breakdown: expect.objectContaining({ trending: expect.objectContaining({ current: { paid: 0, trial: 0, weighted: 0 }, meetsMinVolume: true }) }),
          computedAt: expect.any(Date)
        },
        {
          source: "awesome_akash",
          templateRef: "akash-network-awesome-akash-ollama",
          popularScore: 0.5,
          trendingScore: 0,
          weeklyDeployers: 0,
          isTrending: false,
          breakdown: expect.objectContaining({ popular: expect.objectContaining({ paid: 1, decayedPaid: 0.5 }) }),
          computedAt: expect.any(Date)
        }
      ].sort(byTemplateRef)
    );
    const [{ computedAt }] = await findStoredTemplateScores();
    expect(computedAt.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());
    const nextWindow = nextScoreWindowAt(new Date(), intervalSeconds);
    expect(await findJobRows(SCORE_JOB, { state: "created" })).toMatchObject([
      { singleton_key: recomputeTemplateScoresKeyFor(nextWindow), data: { windowStartsAt: nextWindow.toISOString(), version: 1 } }
    ]);
  });

  it("stores the same scores when it runs again, and drops the score of a template nobody used lately", async () => {
    const { runRecompute } = await setup();
    const template = await seedTemplate({ visibility: "public" });
    await stillRunning(template.id);
    await seedTemplateScore({ templateRef: "akash-network-awesome-akash-forgotten", source: "awesome_akash", computedAt: daysAgo(1) });

    await runRecompute();
    const [first] = await findStoredTemplateScores();
    await runRecompute();
    const [second, ...others] = await findStoredTemplateScores();

    expect(others).toEqual([]);
    expect({ ...second, computedAt: first.computedAt }).toEqual(first);
    expect(first).toMatchObject({ templateRef: template.id, popularScore: 1 });
    expect(second.computedAt.getTime()).toBeGreaterThan(first.computedAt.getTime());
  });

  it("keeps scoring a template that was hidden or made private, whose score no listing serves", async () => {
    const { runRecompute } = await setup();
    const [hidden, unpublished] = await Promise.all([
      seedTemplate({ visibility: "public", moderationStatus: "hidden" }),
      seedTemplate({ visibility: "private" })
    ]);
    await Promise.all([stillRunning(hidden.id), stillRunning(unpublished.id)]);

    await runRecompute();

    expect((await findStoredTemplateScores()).map(({ templateRef }) => templateRef).sort()).toEqual([hidden.id, unpublished.id].sort());
  });

  it("seeds one run for the next window however many replicas seed it, due when the window starts", async () => {
    const { handler, intervalSeconds } = await setup();
    const now = new Date("2030-01-01T05:10:00.000Z");
    const windowStartsAt = nextScoreWindowAt(now, intervalSeconds);

    await Promise.all([handler.seedNextRun(now), handler.seedNextRun(now)]);
    await handler.seedNextRun(new Date(now.getTime() + 60_000));

    const queued = await findJobRows(SCORE_JOB, { singletonKey: recomputeTemplateScoresKeyFor(windowStartsAt) });
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

  it("reads its weights, half-life, windows and minimum volume from the configuration", () => {
    const config: TemplateMarketplaceConfig = {
      ...container.resolve(TEMPLATE_MARKETPLACE_CONFIG),
      TEMPLATE_SCORE_TRIAL_WEIGHT: 0.1,
      TEMPLATE_SCORE_POPULAR_HALF_LIFE_DAYS: 2,
      TEMPLATE_SCORE_POPULAR_WINDOW_DAYS: 3,
      TEMPLATE_SCORE_TRENDING_WINDOW_DAYS: 4,
      TEMPLATE_SCORE_TRENDING_MIN_VOLUME: 5
    };

    expect(scoringSettingsOf(config)).toEqual({ trialWeight: 0.1, popularHalfLifeDays: 2, popularWindowDays: 3, trendingWindowDays: 4, trendingMinVolume: 5 });
  });

  function byTemplateRef(left: { templateRef: string }, right: { templateRef: string }) {
    return left.templateRef.localeCompare(right.templateRef);
  }

  async function setup() {
    const config: TemplateMarketplaceConfig = {
      ...container.resolve(TEMPLATE_MARKETPLACE_CONFIG),
      TEMPLATE_SCORE_TRIAL_WEIGHT: 0.25,
      TEMPLATE_SCORE_POPULAR_HALF_LIFE_DAYS: 30,
      TEMPLATE_SCORE_POPULAR_WINDOW_DAYS: 180,
      TEMPLATE_SCORE_TRENDING_WINDOW_DAYS: 7,
      TEMPLATE_SCORE_TRENDING_MIN_VOLUME: 2,
      TEMPLATE_SCORE_MAX_TEMPLATES: 100
    };
    container.registerInstance(TEMPLATE_MARKETPLACE_CONFIG, config);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    await db.delete(resolveTable("TemplateUsageEvents"));
    await db.delete(resolveTable("TemplateScores"));
    const { enqueue, startWorkers } = await jobWorkers();
    await deleteQueuedJobs(SCORE_JOB);
    await deleteCompletedJobs(SCORE_JOB);
    let runs = 0;

    return {
      handler: container.resolve(RecomputeTemplateScoresHandler),
      intervalSeconds: config.TEMPLATE_SCORE_RECOMPUTE_INTERVAL_SECONDS,
      runRecompute: async () => {
        const windowStartsAt = new Date(Date.UTC(2026, 10, 18, runs++));
        await deleteQueuedJobs(SCORE_JOB);
        await enqueue(new RecomputeTemplateScores({ windowStartsAt: windowStartsAt.toISOString() }), {
          singletonKey: recomputeTemplateScoresKeyFor(windowStartsAt)
        });
        await startWorkers();
        await expectJobCompleted(SCORE_JOB, { singletonKey: recomputeTemplateScoresKeyFor(windowStartsAt) });
      }
    };
  }
});
