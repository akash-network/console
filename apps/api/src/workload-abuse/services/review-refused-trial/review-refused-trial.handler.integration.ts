import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import { DeletedTrialAccountService } from "@src/workload-abuse/services/deleted-trial-account/deleted-trial-account.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { ReviewRefusedTrial, ReviewRefusedTrialHandler } from "./review-refused-trial.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SLACK_ORIGIN = "https://hooks.slack.test";
const SLACK_PATH = "/services/T000/B000/review";
const CONSOLE_ADMIN_URL = "https://console-admin.example.com";

const jobWorkers = useJobWorkers(() => [container.resolve(ReviewRefusedTrialHandler)]);

describe(ReviewRefusedTrialHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("posts a refused trial for review with the deleted account it matched", async () => {
    const { enqueue, runQueuedReviewOf, slackPosts } = await setup();
    const refused = await seedUser({ email: "returning@example.com" });
    const walletAddress = createAkashAddress();

    await enqueue(
      new ReviewRefusedTrial({ userId: refused.id, deletedAccount: { walletAddress, deletedAt: "2026-06-15T12:00:00.000Z", deletionsOnRecord: 2 } })
    );
    await runQueuedReviewOf(refused.id);

    expect(slackPosts).toEqual([
      {
        text: [
          ":no_entry_sign: *Trial refused to a returning account*",
          `returning@example.com · <${CONSOLE_ADMIN_URL}/users/${refused.id}|Admin>`,
          `Matched deleted account: wallet ${walletAddress} · deleted 2026-06-15T12:00:00.000Z`,
          "Deleted trial accounts on record: 2"
        ].join("\n")
      }
    ]);
  });

  it("posts one review for an account whose trial is refused again and again, with the latest deletion it matched", async () => {
    const { deletedTrialAccounts, deleteTrialAccountOf, runQueuedReviewOf, slackPosts } = await setup();
    const identity = { userId: `auth0|${faker.string.alphanumeric(24)}`, email: `${faker.string.alpha({ length: 12, casing: "lower" })}@example.com` };
    await deleteTrialAccountOf(identity);
    const latestWalletAddress = await deleteTrialAccountOf(identity);
    const refused = await seedUser(identity);

    const refusals = [
      await deletedTrialAccounts.refusesTrialOf(refused),
      ...(await Promise.all([deletedTrialAccounts.refusesTrialOf(refused), deletedTrialAccounts.refusesTrialOf(refused)]))
    ];
    await runQueuedReviewOf(refused.id);

    expect(refusals).toEqual([true, true, true]);
    expect(await findJobRows(ReviewRefusedTrial[JOB_NAME], { data: { userId: refused.id } })).toHaveLength(1);
    expect(slackPosts).toEqual([
      {
        text: expect.stringMatching(
          new RegExp(
            `^:no_entry_sign: .*\\n${identity.email} · <${CONSOLE_ADMIN_URL}/users/${refused.id}\\|Admin>\\n` +
              `Matched deleted account: wallet ${latestWalletAddress} · deleted \\d{4}-\\d{2}-\\d{2}T[\\d:.]+Z\\nDeleted trial accounts on record: 2$`
          )
        )
      }
    ]);
  });

  it("queues no review for an account whose trial goes ahead", async () => {
    const { deletedTrialAccounts } = await setup();
    const account = await seedUser({ userId: `auth0|${faker.string.alphanumeric(24)}`, email: faker.internet.email().toLowerCase() });

    await expect(deletedTrialAccounts.refusesTrialOf(account)).resolves.toBe(false);

    expect(await findJobRows(ReviewRefusedTrial[JOB_NAME], { data: { userId: account.id } })).toHaveLength(0);
  });

  it("posts nothing for an account that is gone by the time its review runs", async () => {
    const { enqueue, runQueuedReviewOf, slackPosts } = await setup();
    const userId = faker.string.uuid();

    await enqueue(new ReviewRefusedTrial({ userId, deletedAccount: { walletAddress: null, deletedAt: "2026-06-15T12:00:00.000Z", deletionsOnRecord: 1 } }));
    await runQueuedReviewOf(userId);

    expect(slackPosts).toEqual([]);
  });

  it("posts nothing while the review channel is not configured", async () => {
    const { enqueue, runQueuedReviewOf, slackPosts } = await setup({ webhookUrl: undefined });
    const refused = await seedUser({ email: "returning@example.com" });

    await enqueue(
      new ReviewRefusedTrial({ userId: refused.id, deletedAccount: { walletAddress: null, deletedAt: "2026-06-15T12:00:00.000Z", deletionsOnRecord: 1 } })
    );
    await runQueuedReviewOf(refused.id);

    expect(slackPosts).toEqual([]);
  });

  async function setup(input: { webhookUrl?: string } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();

    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    const workloadAbuseOverrides: Partial<Record<Parameters<typeof readWorkloadAbuseConfig>[0], unknown>> = {
      WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL: "webhookUrl" in input ? input.webhookUrl : `${SLACK_ORIGIN}${SLACK_PATH}`,
      WORKLOAD_ABUSE_DELETED_TRIAL_MEMORY_DAYS: 9,
      WORKLOAD_ABUSE_DELETED_TRIAL_COOLDOWN_HOURS: 4,
      WORKLOAD_ABUSE_DELETED_TRIAL_MAX_RETURNS: undefined
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

    const deletedTrialAccounts = container.resolve(DeletedTrialAccountService);

    return {
      enqueue,
      slackPosts,
      deletedTrialAccounts,
      deleteTrialAccountOf: async (identity: { userId: string; email: string }) => {
        const address = createAkashAddress();
        await deletedTrialAccounts.remember({ id: faker.string.uuid(), ...identity }, { address, activatedAt: new Date(), isTrialing: true });

        return address;
      },
      runQueuedReviewOf: async (userId: string) => {
        await startWorkers();
        await expectJobCompleted(ReviewRefusedTrial[JOB_NAME], { data: { userId } });
      }
    };
  }
});
