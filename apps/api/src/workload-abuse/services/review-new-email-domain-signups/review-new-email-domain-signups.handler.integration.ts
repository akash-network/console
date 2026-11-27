import { faker } from "@faker-js/faker";
import { subDays, subHours } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import type { UserOutput } from "@src/user/repositories";
import { TrialSignupHoldService } from "@src/workload-abuse/services/trial-signup-hold/trial-signup-hold.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { ReviewNewEmailDomainSignups, ReviewNewEmailDomainSignupsHandler, reviewNewEmailDomainSignupsKeyFor } from "./review-new-email-domain-signups.handler";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/new-domain";
const CONSOLE_ADMIN_URL = "https://console-admin.example.com";

const jobWorkers = useJobWorkers(() => [container.resolve(ReviewNewEmailDomainSignupsHandler)]);

describe(ReviewNewEmailDomainSignupsHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("grants the first sign-up from a new domain and queues no review", async () => {
    const { signUp, isHeld, reviewKey } = await setup();
    const first = await signUp("first");

    expect(await isHeld(first)).toBe(false);
    expect(await findJobRows(ReviewNewEmailDomainSignups[JOB_NAME], { singletonKey: reviewKey })).toEqual([]);
  });

  it("holds the next sign-ups from the domain and posts its recent accounts for review once", async () => {
    const { domain, signUp, isHeld, startWorkers, slackPosts, reviewKey } = await setup();
    const first = await signUp("first", { createdAt: subHours(new Date(), 3) });
    const second = await signUp("second", { createdAt: subHours(new Date(), 2) });
    const third = await signUp("third", { createdAt: subHours(new Date(), 1) });
    await signUp("unverified", { emailVerified: false });

    expect(await isHeld(second)).toBe(true);
    expect(await isHeld(third)).toBe(true);
    expect(await findJobRows(ReviewNewEmailDomainSignups[JOB_NAME], { singletonKey: reviewKey })).toHaveLength(1);

    await startWorkers();
    await expectJobCompleted(ReviewNewEmailDomainSignups[JOB_NAME], { singletonKey: reviewKey });

    expect(slackPosts).toEqual([
      {
        text: [
          ":no_entry: *Trial held for sign-ups from a new email domain*",
          `second@${domain} · <${CONSOLE_ADMIN_URL}/users/${second.id}|Admin>`,
          `Verified sign-ups on ${domain} in the last 24 h (3):`,
          `• third@${domain} · <${CONSOLE_ADMIN_URL}/users/${third.id}|Admin>`,
          `• second@${domain} · <${CONSOLE_ADMIN_URL}/users/${second.id}|Admin>`,
          `• first@${domain} · <${CONSOLE_ADMIN_URL}/users/${first.id}|Admin>`
        ].join("\n")
      }
    ]);
  });

  it("grants a sign-up whose domain has an account from before the window's minimum age", async () => {
    const { signUp, isHeld, reviewKey } = await setup();
    await signUp("founder", { createdAt: subDays(new Date(), 45) });
    await signUp("first", { createdAt: subHours(new Date(), 2) });
    const second = await signUp("second");

    expect(await isHeld(second)).toBe(false);
    expect(await findJobRows(ReviewNewEmailDomainSignups[JOB_NAME], { singletonKey: reviewKey })).toEqual([]);
  });

  it("grants a sign-up once the domain's earlier ones have left the window", async () => {
    const { signUp, isHeld } = await setup();
    await signUp("first", { createdAt: subDays(new Date(), 2) });
    const second = await signUp("second");

    expect(await isHeld(second)).toBe(false);
  });

  it("grants the trial and queues nothing in report mode", async () => {
    const { signUp, isHeld, reviewKey } = await setup({ mode: "report" });
    await signUp("first");
    const second = await signUp("second");

    expect(await isHeld(second)).toBe(false);
    expect(await findJobRows(ReviewNewEmailDomainSignups[JOB_NAME], { singletonKey: reviewKey })).toEqual([]);
  });

  it("completes without posting when the account was deleted before its review ran", async () => {
    const { domain, enqueue, startWorkers, slackPosts, reviewKey } = await setup();

    await enqueue(new ReviewNewEmailDomainSignups({ userId: faker.string.uuid(), domain, windowHours: 24 }), { singletonKey: reviewKey });
    await startWorkers();
    await expectJobCompleted(ReviewNewEmailDomainSignups[JOB_NAME], { singletonKey: reviewKey });

    expect(slackPosts).toEqual([]);
  });

  it("completes without posting while no review webhook is configured", async () => {
    const { signUp, isHeld, startWorkers, slackPosts, reviewKey } = await setup({ webhookUrl: undefined });
    await signUp("first");
    const second = await signUp("second");

    expect(await isHeld(second)).toBe(true);
    await startWorkers();
    await expectJobCompleted(ReviewNewEmailDomainSignups[JOB_NAME], { singletonKey: reviewKey });

    expect(slackPosts).toEqual([]);
  });

  async function setup(input: { mode?: "report" | "enforce"; webhookUrl?: string } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const domain = `${faker.string.alpha({ length: 16, casing: "lower" })}.xyz`;

    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    const workloadAbuseOverrides: Partial<Record<Parameters<typeof readWorkloadAbuseConfig>[0], unknown>> = {
      WORKLOAD_ABUSE_SIGNUP_HOLD_MODE: "off",
      WORKLOAD_ABUSE_GENERATED_EMAIL_TAG_HOLD_MODE: "off",
      WORKLOAD_ABUSE_EMAIL_DOMAIN_HOLD_MODE: "off",
      WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_HOLD_MODE: input.mode ?? "enforce",
      WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_MIN_SIGNUPS: 2,
      WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_WINDOW_HOURS: 24,
      WORKLOAD_ABUSE_DOMAIN_BLOCK_MIN_ACCOUNT_AGE_DAYS: 30,
      WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL: "webhookUrl" in input ? input.webhookUrl : `${SLACK_ORIGIN}${SLACK_PATH}`
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

    const holdService = container.resolve(TrialSignupHoldService);

    return {
      domain,
      enqueue,
      startWorkers,
      slackPosts,
      reviewKey: reviewNewEmailDomainSignupsKeyFor(domain),
      signUp: (localPart: string, overrides: { createdAt?: Date; emailVerified?: boolean } = {}) =>
        seedUser({ userId: faker.string.uuid(), email: `${localPart}@${domain}`, emailVerified: true, ...overrides }),
      isHeld: (user: UserOutput) => holdService.isHeld(user)
    };
  }
});
