import { faker } from "@faker-js/faker";
import { addMinutes, subDays, subHours } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { DailySignupSummaryHandler, dailySignupSummaryKeyFor, PostDailySignupSummary } from "./daily-signup-summary.handler";

import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/review";
const CONSOLE_ADMIN_URL = "https://console-admin.example.com";

const jobWorkers = useJobWorkers(() => [container.resolve(DailySignupSummaryHandler)]);

describe(DailySignupSummaryHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("posts the window's sign-ups, trials, shared devices and email domains", async () => {
    const { summarize, slackPosts } = await setup();
    const now = new Date();
    const domain = `${faker.string.alpha({ length: 10, casing: "lower" })}.io`;
    const fingerprint = faker.string.hexadecimal({ length: 64 });
    const sharedDevice = await Promise.all(
      ["auth0|a", "google-oauth2|b", "github|c"].map(userId =>
        seedUser({ userId: `${userId}${faker.string.uuid()}`, email: `${userId[0]}@${domain}`, lastFingerprint: fingerprint })
      )
    );
    await seedUser({ userId: `auth0|${faker.string.uuid()}`, email: faker.internet.email(), createdAt: subDays(now, 3) });
    await seedUserWithWallet({ user: { userId: `auth0|${faker.string.uuid()}`, email: `trial@${domain}` }, isTrialing: true, activatedAt: now });
    await seedUserWithWallet({ user: { createdAt: subDays(now, 3) }, isTrialing: false, activatedAt: now });
    await seedUserWithWallet({ user: { createdAt: subDays(now, 3) }, isTrialing: true, activatedAt: subDays(now, 3) });
    await seedUserWithWallet({
      user: { createdAt: subDays(now, 3) },
      isTrialing: false,
      activatedAt: subHours(now, 2),
      abuseLockedAt: subHours(now, 1),
      abuseLockedReason: "workload_abuse"
    });
    await seedUserWithWallet({
      user: { createdAt: subDays(now, 3) },
      isTrialing: false,
      activatedAt: now,
      abuseLockedAt: now,
      abuseLockedReason: "blocked_domain"
    });

    await summarize(addMinutes(now, 5));

    expect(slackPosts).toHaveLength(1);
    const lines = slackPosts[0].text.split("\n");
    expect(lines[1]).toBe("New accounts: 4 (Email 2 · GitHub 1 · Google 1)");
    expect(lines[2]).toBe("Trials started: 2");
    expect(lines).toEqual(
      expect.arrayContaining([
        "*Shared device fingerprints (1)*",
        "• 3 accounts on one device",
        ...sharedDevice.map(account => `    ◦ ${account.email} · <${CONSOLE_ADMIN_URL}/users/${account.id}|Admin>`),
        "*Top email domains*",
        `• <${CONSOLE_ADMIN_URL}/users?q=%40${domain}|${domain}> 4`
      ])
    );
  });

  it("posts the headline numbers of a quiet day once, however often the day is queued", async () => {
    const { summarize, slackPosts } = await setup();
    const windowEndsAt = subDays(new Date(), 30);

    await summarize(windowEndsAt);
    await summarize(windowEndsAt);

    expect(slackPosts).toEqual([{ text: expect.stringMatching(/\nNew accounts: 0\nTrials started: 0$/) }]);
  });

  it("queues the next day's summary and refuses a second one for the same day", async () => {
    const { enqueue, summarize } = await setup();
    const windowEndsAt = subDays(new Date(), 40);

    await summarize(windowEndsAt);

    const [nextRun] = await findJobRows(PostDailySignupSummary[JOB_NAME], { state: "created" });
    expect(nextRun.singleton_key).toMatch(/^dailySignupSummary\.\d{4}-\d{2}-\d{2}$/);
    expect(new Date(nextRun.start_after).getTime()).toBeGreaterThan(Date.now());
    const duplicate = await enqueue(new PostDailySignupSummary({ windowEndsAt: new Date(nextRun.start_after).toISOString() }), {
      singletonKey: nextRun.singleton_key!
    });
    expect(duplicate).toBeNull();
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    vi.spyOn(workloadAbuseConfig, "get").mockImplementation((key =>
      key === "WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL"
        ? `${SLACK_ORIGIN}${SLACK_PATH}`
        : readWorkloadAbuseConfig(key)) as typeof workloadAbuseConfig.get);
    const billingConfig = container.resolve(BillingConfigService);
    const readBillingConfig = billingConfig.get.bind(billingConfig);
    vi.spyOn(billingConfig, "get").mockImplementation((key =>
      key === "CONSOLE_ADMIN_URL" ? CONSOLE_ADMIN_URL : readBillingConfig(key)) as typeof billingConfig.get);

    const slackPosts: { text: string }[] = [];
    nock(SLACK_ORIGIN)
      .post(SLACK_PATH, body => {
        slackPosts.push(body);
        return true;
      })
      .reply(200, "ok")
      .persist();

    return {
      enqueue,
      slackPosts,
      summarize: async (windowEndsAt: Date) => {
        const windowEndsAtIso = windowEndsAt.toISOString();
        await enqueue(new PostDailySignupSummary({ windowEndsAt: windowEndsAtIso }), { singletonKey: dailySignupSummaryKeyFor(windowEndsAt) });
        await startWorkers();
        await vi.waitFor(
          async () => {
            const runs = await findJobRows(PostDailySignupSummary[JOB_NAME], { data: { windowEndsAt: windowEndsAtIso } });
            expect(runs.map(({ state, output }) => ({ state, output }))).toEqual(runs.map(() => ({ state: "completed", output: null })));
          },
          { timeout: 30_000, interval: 200 }
        );
      }
    };
  }
});
