import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import type { UserOutput } from "@src/user/repositories";
import {
  reviewHeldTrialSignupKeyFor,
  ReviewTrialSignup,
  ReviewTrialSignupHandler
} from "@src/workload-abuse/services/review-trial-signup/review-trial-signup.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialSignupHoldService } from "./trial-signup-hold.service";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/hold";

const jobWorkers = useJobWorkers(() => [container.resolve(ReviewTrialSignupHandler)]);

describe(TrialSignupHoldService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("keeps a single held report queued across refused attempts and posts it as held", async () => {
    const { seedAccount, attemptTrial, startWorkers, slackPosts } = await setup();
    await seedAccount({ email: "first@example.com" });
    await seedAccount({ email: "second@example.com" });
    const signup = await seedAccount({ email: "third@example.com" });

    await expect(attemptTrial(signup)).rejects.toThrow("refused");
    await expect(attemptTrial(signup)).rejects.toThrow("refused");

    expect(await findJobRows(ReviewTrialSignup[JOB_NAME], { singletonKey: reviewHeldTrialSignupKeyFor(signup.id) })).toHaveLength(1);

    await startWorkers();
    await expectJobCompleted(ReviewTrialSignup[JOB_NAME], { singletonKey: reviewHeldTrialSignupKeyFor(signup.id) });

    expect(slackPosts).toHaveLength(1);
    expect(slackPosts[0].text.split("\n")).toEqual([
      ":no_entry: *Trial held pending review*",
      "third@example.com",
      "Linked accounts (2):",
      expect.stringMatching(/^• (first|second)@example\.com$/),
      expect.stringMatching(/^• (first|second)@example\.com$/)
    ]);
  });

  it("lifts the hold once the linked accounts have left the review window", async () => {
    const { seedAccount, attemptTrial } = await setup();
    await seedAccount({ email: "first@example.com", lastActiveAt: subDays(new Date(), 2) });
    await seedAccount({ email: "second@example.com", lastActiveAt: subDays(new Date(), 2) });
    const signup = await seedAccount({ email: "third@example.com" });

    await expect(attemptTrial(signup)).resolves.toBe("granted");
    expect(await findJobRows(ReviewTrialSignup[JOB_NAME], { singletonKey: reviewHeldTrialSignupKeyFor(signup.id) })).toEqual([]);
  });

  async function setup() {
    const { startWorkers } = await jobWorkers();
    const fingerprint = faker.string.hexadecimal({ length: 64 });

    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    const workloadAbuseOverrides: Partial<Record<Parameters<typeof readWorkloadAbuseConfig>[0], unknown>> = {
      WORKLOAD_ABUSE_SIGNUP_HOLD_MODE: "enforce",
      WORKLOAD_ABUSE_SIGNUP_HOLD_MIN_LINKED_ACCOUNTS: 2,
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

    const holdService = container.resolve(TrialSignupHoldService);
    const txService = container.resolve(TxService);

    return {
      startWorkers,
      slackPosts,
      seedAccount: (overrides: { email: string; lastActiveAt?: Date }) => seedUser({ lastFingerprint: fingerprint, lastActiveAt: new Date(), ...overrides }),
      attemptTrial: (user: UserOutput) =>
        txService.transaction(async () => {
          if (await holdService.isHeld(user)) throw new Error("refused");
          return "granted";
        })
    };
  }
});
