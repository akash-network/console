import { faker } from "@faker-js/faker";
import { subHours } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import type { UserOutput } from "@src/user/repositories";
import { RefusedSignupService } from "@src/workload-abuse/services/refused-signup/refused-signup.service";
import { TrialSignupHoldService } from "@src/workload-abuse/services/trial-signup-hold/trial-signup-hold.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import {
  ReviewTrialAfterRefusedSignup,
  ReviewTrialAfterRefusedSignupHandler,
  reviewTrialAfterRefusedSignupKeyFor
} from "./review-trial-after-refused-signup.handler";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/refused-signup";
const CONSOLE_ADMIN_URL = "https://console-admin.example.com";

const jobWorkers = useJobWorkers(() => [container.resolve(ReviewTrialAfterRefusedSignupHandler)]);

describe(ReviewTrialAfterRefusedSignupHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("holds the trial of an account created in a browser that was just refused, and posts it for review once", async () => {
    const { browser, refuseSignupIn, signUpIn, isHeld, startWorkers, slackPosts } = await setup();
    await refuseSignupIn(browser);
    const account = await signUpIn(browser, "next@fresh-domain.xyz");

    expect(await isHeld(account)).toBe(true);
    expect(await isHeld(account)).toBe(true);
    expect(await findJobRows(ReviewTrialAfterRefusedSignup[JOB_NAME], { singletonKey: reviewTrialAfterRefusedSignupKeyFor(account.id) })).toHaveLength(1);

    await startWorkers();
    await expectJobCompleted(ReviewTrialAfterRefusedSignup[JOB_NAME], { singletonKey: reviewTrialAfterRefusedSignupKeyFor(account.id) });

    expect(slackPosts).toEqual([
      {
        text: [
          ":no_entry: *Trial held after a refused sign-up*",
          `next@fresh-domain.xyz · <${CONSOLE_ADMIN_URL}/users/${account.id}|Admin>`,
          "A sign-up from this browser was refused in the 60 min before this account asked for its trial."
        ].join("\n")
      }
    ]);
  });

  it("grants the trial of an account created in a browser that was never refused", async () => {
    const { browser, refuseSignupIn, signUpIn, isHeld } = await setup();
    await refuseSignupIn({ ...browser, ip: faker.internet.ipv4() });
    await refuseSignupIn({ ...browser, userAgent: "curl/8.7" });
    const account = await signUpIn(browser, "someone@example.org");

    expect(await isHeld(account)).toBe(false);
    expect(await findJobRows(ReviewTrialAfterRefusedSignup[JOB_NAME], { singletonKey: reviewTrialAfterRefusedSignupKeyFor(account.id) })).toEqual([]);
  });

  it("grants the trial once the refusal has left the window, and forgets it at the next refusal", async () => {
    const { browser, refuseSignupIn, ageRefusals, countRefusals, signUpIn, isHeld } = await setup();
    await refuseSignupIn(browser);
    await ageRefusals(subHours(new Date(), 30));
    const account = await signUpIn(browser, "later@example.org");

    expect(await isHeld(account)).toBe(false);

    await refuseSignupIn({ ...browser, ip: faker.internet.ipv4() });

    expect(await countRefusals()).toBe(1);
  });

  it("grants the trial and queues nothing in report mode", async () => {
    const { browser, refuseSignupIn, signUpIn, isHeld } = await setup({ mode: "report" });
    await refuseSignupIn(browser);
    const account = await signUpIn(browser, "next@fresh-domain.xyz");

    expect(await isHeld(account)).toBe(false);
    expect(await findJobRows(ReviewTrialAfterRefusedSignup[JOB_NAME], { singletonKey: reviewTrialAfterRefusedSignupKeyFor(account.id) })).toEqual([]);
  });

  it("keeps the address and the user agent of a refused browser out of the table", async () => {
    const { browser, refuseSignupIn, readRefusals } = await setup();

    await refuseSignupIn(browser);

    const stored = JSON.stringify(await readRefusals());
    expect(stored).toMatch(/"browserHash":"[0-9a-f]{64}"/);
    expect(stored).not.toContain(browser.ip);
    expect(stored).not.toContain(browser.userAgent);
  });

  it("completes without posting when the account was deleted before its review ran, or no review webhook is configured", async () => {
    const { browser, refuseSignupIn, signUpIn, isHeld, enqueue, startWorkers, slackPosts } = await setup({ webhookUrl: undefined });
    const deletedUserId = faker.string.uuid();
    await enqueue(new ReviewTrialAfterRefusedSignup({ userId: deletedUserId, windowMinutes: 60 }), {
      singletonKey: reviewTrialAfterRefusedSignupKeyFor(deletedUserId)
    });
    await refuseSignupIn(browser);
    const account = await signUpIn(browser, "next@fresh-domain.xyz");
    expect(await isHeld(account)).toBe(true);

    await startWorkers();
    await expectJobCompleted(ReviewTrialAfterRefusedSignup[JOB_NAME], { singletonKey: reviewTrialAfterRefusedSignupKeyFor(deletedUserId) });
    await expectJobCompleted(ReviewTrialAfterRefusedSignup[JOB_NAME], { singletonKey: reviewTrialAfterRefusedSignupKeyFor(account.id) });

    expect(slackPosts).toEqual([]);
  });

  async function setup(input: { mode?: "report" | "enforce"; webhookUrl?: string } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const refusedSignups = resolveTable("RefusedSignups");
    await db.delete(refusedSignups);

    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    const workloadAbuseOverrides: Partial<Record<Parameters<typeof readWorkloadAbuseConfig>[0], unknown>> = {
      WORKLOAD_ABUSE_SIGNUP_HOLD_MODE: "off",
      WORKLOAD_ABUSE_GENERATED_EMAIL_TAG_HOLD_MODE: "off",
      WORKLOAD_ABUSE_EMAIL_DOMAIN_HOLD_MODE: "off",
      WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_HOLD_MODE: "off",
      WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_MODE: input.mode ?? "enforce",
      WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_WINDOW_MINUTES: 60,
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

    const refusedSignupService = container.resolve(RefusedSignupService);
    const holdService = container.resolve(TrialSignupHoldService);

    return {
      enqueue,
      startWorkers,
      slackPosts,
      browser: { ip: faker.internet.ipv4(), userAgent: `Mozilla/5.0 Chrome/${faker.number.int({ min: 100, max: 999 })}.0` },
      refuseSignupIn: (browser: { ip: string; userAgent: string }) => refusedSignupService.remember(browser),
      signUpIn: (browser: { ip: string; userAgent: string }, email: string) =>
        seedUser({ userId: faker.string.uuid(), email, emailVerified: true, lastIp: browser.ip, lastUserAgent: browser.userAgent }),
      isHeld: (user: UserOutput) => holdService.isHeld(user),
      ageRefusals: async (createdAt: Date) => {
        await db.update(refusedSignups).set({ createdAt });
      },
      countRefusals: async () => (await db.select({ id: refusedSignups.id }).from(refusedSignups)).length,
      readRefusals: async () => await db.select().from(refusedSignups)
    };
  }
});
