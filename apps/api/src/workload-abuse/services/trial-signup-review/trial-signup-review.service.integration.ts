import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import {
  ReviewTrialSignup,
  ReviewTrialSignupHandler,
  reviewTrialSignupKeyFor
} from "@src/workload-abuse/services/review-trial-signup/review-trial-signup.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialSignupReviewService } from "./trial-signup-review.service";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/review-once";

const jobWorkers = useJobWorkers(() => [container.resolve(ReviewTrialSignupHandler)]);

describe(TrialSignupReviewService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("posts a burst of sign-ups from one device once per window", async () => {
    const { signUp, startWorkers, slackPosts, reviewKey } = await setup();
    await signUp("first@example.com");
    await signUp("second@example.com");
    await startWorkers();
    await expectJobCompleted(ReviewTrialSignup[JOB_NAME], { singletonKey: reviewKey });

    await signUp("third@example.com");
    await signUp("fourth@example.com");

    expect(await findJobRows(ReviewTrialSignup[JOB_NAME], { singletonKey: reviewKey })).toHaveLength(1);
    expect(slackPosts).toHaveLength(1);
    expect(slackPosts[0].text.split("\n")).toEqual([
      ":mag: *Trial sign-up flagged for review*",
      "second@example.com",
      "Linked accounts (1):",
      "• first@example.com"
    ]);
  });

  async function setup() {
    const { startWorkers } = await jobWorkers();
    const fingerprint = faker.string.hexadecimal({ length: 64 });

    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    const workloadAbuseOverrides: Partial<Record<Parameters<typeof readWorkloadAbuseConfig>[0], unknown>> = {
      WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: 45,
      WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL: `${SLACK_ORIGIN}${SLACK_PATH}`
    };
    vi.spyOn(workloadAbuseConfig, "get").mockImplementation((key =>
      key in workloadAbuseOverrides ? workloadAbuseOverrides[key] : readWorkloadAbuseConfig(key)) as typeof workloadAbuseConfig.get);

    const billingConfig = container.resolve(BillingConfigService);
    const readBillingConfig = billingConfig.get.bind(billingConfig);
    vi.spyOn(billingConfig, "get").mockImplementation((key => (key === "CONSOLE_ADMIN_URL" ? undefined : readBillingConfig(key))) as typeof billingConfig.get);

    const slackPosts: { text: string }[] = [];
    nock(SLACK_ORIGIN)
      .post(SLACK_PATH, body => {
        slackPosts.push(body);
        return true;
      })
      .reply(200, "ok")
      .persist();

    const service = container.resolve(TrialSignupReviewService);

    return {
      startWorkers,
      slackPosts,
      reviewKey: reviewTrialSignupKeyFor(fingerprint),
      signUp: async (email: string) => {
        const user = await seedUser({ email, lastFingerprint: fingerprint, lastActiveAt: new Date() });
        await service.flagIfLinked(user);
      }
    };
  }
});
