import "@src/app/providers/jobs.provider";

import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreditsAdded } from "@src/billing/events/credits-added";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { DOMAIN_EVENT_NAME } from "@src/core/services/domain-events/domain-events.service";
import { CreditsAddedSlackAlertHandler } from "./credits-added-slack-alert.handler";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/credits";
const AMPLITUDE_PROJECT_URL = "https://app.amplitude.com/analytics/example-org/project/100001";
const CONSOLE_ADMIN_URL = "https://console-admin.example.com";
const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.example/acct_test";
const MISSING_USER_ID = "00000000-0000-0000-0000-000000000000";

type CreditsAddedInput = Pick<CreditsAdded["data"], "userId" | "transactionId"> & Partial<CreditsAdded["data"]>;

const jobWorkers = useJobWorkers(() => [container.resolve(CreditsAddedSlackAlertHandler)]);

describe(CreditsAddedSlackAlertHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("posts the credited amount, the buyer and links to their Amplitude sessions, admin page and Stripe records", async () => {
    const { user, creditsAdded, slackPosts } = await setup({ email: "buyer@example.com" });

    await creditsAdded({ userId: user.id, transactionId: "tx-card-purchase", stripeCustomerId: "cus_buyer", stripePaymentIntentId: "pi_buyer" });

    expect(slackPosts).toEqual([
      {
        text: [
          ":credit_card: *Card purchase* · *$25.00* credited",
          "buyer@example.com",
          [
            `<${AMPLITUDE_PROJECT_URL}/search/user_id%3D${user.id}|Amplitude sessions>`,
            `<${CONSOLE_ADMIN_URL}/users/${user.id}|Admin>`,
            `<${STRIPE_DASHBOARD_URL}/customers/cus_buyer|Stripe customer>`,
            `<${STRIPE_DASHBOARD_URL}/payments/pi_buyer|Stripe payment>`
          ].join(" · ")
        ].join("\n")
      }
    ]);
  });

  it("names the buyer by id when the user no longer exists", async () => {
    const { creditsAdded, slackPosts } = await setup({ email: "buyer@example.com" });

    await creditsAdded({ userId: MISSING_USER_ID, transactionId: "tx-missing-user" });

    expect(slackPosts).toHaveLength(1);
    expect(slackPosts[0].text.split("\n")[1]).toBe(MISSING_USER_ID);
  });

  it("posts nothing when no Slack webhook is configured", async () => {
    const { user, creditsAdded, slackPosts } = await setup({ email: "buyer@example.com", webhookUrl: undefined });

    await creditsAdded({ userId: user.id, transactionId: "tx-unconfigured" });

    expect(slackPosts).toEqual([]);
  });

  it("leaves the job to be retried when Slack rejects the post", async () => {
    const { user, enqueueCreditsAdded } = await setup({ email: "buyer@example.com", slackStatus: 500 });

    await enqueueCreditsAdded({ userId: user.id, transactionId: "tx-slack-down" });

    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(CreditsAdded[DOMAIN_EVENT_NAME], { data: { transactionId: "tx-slack-down" } });
        expect(row?.state).toBe("retry");
      },
      { timeout: 20_000, interval: 250 }
    );
  });

  async function setup(input: { email: string; webhookUrl?: string; slackStatus?: number }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const user = await seedUser({ email: input.email });
    const webhookUrl = "webhookUrl" in input ? input.webhookUrl : `${SLACK_ORIGIN}${SLACK_PATH}`;

    const billingConfig = container.resolve(BillingConfigService);
    const readConfig = billingConfig.get.bind(billingConfig);
    const overrides: Partial<Record<Parameters<typeof readConfig>[0], unknown>> = {
      CREDITS_ADDED_SLACK_WEBHOOK_URL: webhookUrl,
      AMPLITUDE_PROJECT_URL,
      CONSOLE_ADMIN_URL,
      STRIPE_DASHBOARD_URL
    };
    vi.spyOn(billingConfig, "get").mockImplementation((key => (key in overrides ? overrides[key] : readConfig(key))) as typeof billingConfig.get);

    const slackPosts: { text: string }[] = [];
    nock(SLACK_ORIGIN)
      .post(SLACK_PATH, body => {
        slackPosts.push(body);
        return true;
      })
      .reply(input.slackStatus ?? 200, "ok")
      .persist();

    const enqueueCreditsAdded = async (event: CreditsAddedInput) => {
      await enqueue(new CreditsAdded({ source: "payment_intent", isAutoRecharge: false, paidAmountCents: 2500, bonusAmountCents: 0, ...event }));
      await startWorkers();
    };

    return {
      user,
      slackPosts,
      enqueueCreditsAdded,
      creditsAdded: async (event: CreditsAddedInput) => {
        await enqueueCreditsAdded(event);
        await expectJobCompleted(CreditsAdded[DOMAIN_EVENT_NAME], { data: { transactionId: event.transactionId } });
      }
    };
  }
});
