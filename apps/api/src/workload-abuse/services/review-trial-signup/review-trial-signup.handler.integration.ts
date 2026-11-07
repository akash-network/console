import { faker } from "@faker-js/faker";
import { subDays, subMinutes } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import type { UserOutput } from "@src/user/repositories";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { ReviewTrialSignup, ReviewTrialSignupHandler } from "./review-trial-signup.handler";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/review";
const CONSOLE_ADMIN_URL = "https://console-admin.example.com";
const REVIEW_WINDOW_MINUTES = 45;

const jobWorkers = useJobWorkers(() => [container.resolve(ReviewTrialSignupHandler)]);

describe(ReviewTrialSignupHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("posts a trial sign-up for review with the accounts linked to it", async () => {
    const { seedAccount, review, slackPosts } = await setup();
    const linked = await seedAccount({ email: "first@example.com", lastActiveAt: subMinutes(new Date(), 5) });
    const signup = await seedAccount({ email: "second@example.com" });

    await review(signup);

    expect(slackPosts).toEqual([
      {
        text: [
          ":mag: *Trial sign-up flagged for review*",
          `second@example.com · <${CONSOLE_ADMIN_URL}/users/${signup.id}|Admin>`,
          "Linked accounts (1):",
          `• first@example.com · <${CONSOLE_ADMIN_URL}/users/${linked.id}|Admin>`
        ].join("\n")
      }
    ]);
  });

  it("does not flag an ordinary single sign-up", async () => {
    const { seedAccount, review, slackPosts } = await setup();
    await seedUser({ email: "elsewhere@example.com", lastFingerprint: faker.string.hexadecimal({ length: 64 }), lastActiveAt: new Date() });
    const signup = await seedAccount({ email: "single@example.com" });

    await review(signup);

    expect(slackPosts).toEqual([]);
  });

  it("links only accounts active within the review window", async () => {
    const { seedAccount, review, slackPosts } = await setup();
    await seedAccount({ email: "dormant@example.com", lastActiveAt: subDays(new Date(), 2) });
    const signup = await seedAccount({ email: "fresh@example.com" });

    await review(signup);

    expect(slackPosts).toEqual([]);
  });

  it("reviews nothing while the review window is not configured", async () => {
    const { seedAccount, review, slackPosts } = await setup({ windowMinutes: undefined });
    await seedAccount({ email: "first@example.com", lastActiveAt: new Date() });
    const signup = await seedAccount({ email: "second@example.com" });

    await review(signup);

    expect(slackPosts).toEqual([]);
  });

  async function setup(input: { windowMinutes?: number } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const fingerprint = faker.string.hexadecimal({ length: 64 });

    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    const workloadAbuseOverrides: Partial<Record<Parameters<typeof readWorkloadAbuseConfig>[0], unknown>> = {
      WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: "windowMinutes" in input ? input.windowMinutes : REVIEW_WINDOW_MINUTES,
      WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL: `${SLACK_ORIGIN}${SLACK_PATH}`
    };
    vi.spyOn(workloadAbuseConfig, "get").mockImplementation((key =>
      key in workloadAbuseOverrides ? workloadAbuseOverrides[key] : readWorkloadAbuseConfig(key)) as typeof workloadAbuseConfig.get);

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
      slackPosts,
      seedAccount: (overrides: { email: string; lastActiveAt?: Date }) => seedUser({ lastFingerprint: fingerprint, lastActiveAt: new Date(), ...overrides }),
      review: async (user: UserOutput) => {
        await enqueue(new ReviewTrialSignup({ userId: user.id }));
        await startWorkers();
        await expectJobCompleted(ReviewTrialSignup[JOB_NAME], { data: { userId: user.id } });
      }
    };
  }
});
