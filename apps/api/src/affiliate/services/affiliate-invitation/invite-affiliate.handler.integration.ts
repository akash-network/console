import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AffiliateInvitationRepository } from "@src/affiliate/repositories/affiliate-invitation/affiliate-invitation.repository";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { JOB_NAME } from "@src/core";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { InviteAffiliateHandler } from "./invite-affiliate.handler";
import { InviteAffiliate, inviteAffiliateKeyFor } from "./invite-affiliate.job";

import { seedPersonalOrganizationIdOf, seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { deleteCompletedJobs, expectJobCompleted, findJobRows, makeJobDue, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const JOB = InviteAffiliate[JOB_NAME];
const UNSUBSCRIBE_SECRET = faker.string.alphanumeric(32);

const jobWorkers = useJobWorkers(() => [container.resolve(InviteAffiliateHandler)]);

type SentNotification = {
  userId: string | undefined;
  body: { notificationId: string; payload: { summary: string; actions: { label: string; url: string }[] }; unsubscribe?: { url: string } };
};

describe(InviteAffiliateHandler.name, () => {
  beforeAll(() => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", UNSUBSCRIBE_SECRET);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("emails a person who spent enough to join, once, and records the invitation", async () => {
    const { person, payOnPersonalAccount, answerNotifications, invite } = await setup();
    await payOnPersonalAccount(100_00);
    const notifications = answerNotifications();

    await invite();
    await deleteCompletedJobs(JOB);
    await invite();

    expect(notifications).toEqual([
      {
        userId: person.id,
        body: expect.objectContaining({
          notificationId: `affiliateInvitation.${person.id}`,
          payload: expect.objectContaining({
            summary: "Earn Console credit by referring friends",
            actions: [{ label: "Join the referral program", url: `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/referrals` }]
          }),
          unsubscribe: expect.objectContaining({ url: expect.stringContaining("/unsubscribe?token=") })
        })
      }
    ]);
    await expect(container.resolve(AffiliateInvitationRepository).findByUserId(person.id)).resolves.toEqual({ userId: person.id, sentAt: expect.any(Date) });
  });

  it("emails nothing and records nothing for a person who spent too little", async () => {
    const { person, payOnPersonalAccount, answerNotifications, invite } = await setup();
    await payOnPersonalAccount(99_99);
    const notifications = answerNotifications();

    await invite();

    expect(notifications).toEqual([]);
    await expect(container.resolve(AffiliateInvitationRepository).findByUserId(person.id)).resolves.toBeUndefined();
  });

  it("records the invitation without emailing a person who opted out of product updates, so they are never asked again", async () => {
    const { person, payOnPersonalAccount, answerNotifications, invite } = await setup({ productUpdatesUnsubscribedAt: new Date() });
    await payOnPersonalAccount(100_00);
    const notifications = answerNotifications();

    await invite();

    expect(notifications).toEqual([]);
    await expect(container.resolve(AffiliateInvitationRepository).findByUserId(person.id)).resolves.toEqual({ userId: person.id, sentAt: expect.any(Date) });
  });

  it("releases the claim when the email fails, so the retry of the same job sends it once and records the invitation", async () => {
    const { person, payOnPersonalAccount, answerNotifications, invite } = await setup();
    await payOnPersonalAccount(100_00);
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    let failedRequests = 0;
    nock(notificationsBaseUrl)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(() => {
        failedRequests += 1;
        return [500];
      });

    await invite({ expectState: "retry" });

    expect(failedRequests).toBeGreaterThan(0);
    await expect(container.resolve(AffiliateInvitationRepository).findByUserId(person.id)).resolves.toBeUndefined();

    nock.cleanAll();
    const notifications = answerNotifications();
    await makeJobDue(JOB, { singletonKey: inviteAffiliateKeyFor(person.id) });
    await expectJobCompleted(JOB, { singletonKey: inviteAffiliateKeyFor(person.id) });

    expect(notifications).toEqual([expect.objectContaining({ userId: person.id })]);
    await expect(container.resolve(AffiliateInvitationRepository).findByUserId(person.id)).resolves.toEqual({ userId: person.id, sentAt: expect.any(Date) });
  });

  async function setup(input: { productUpdatesUnsubscribedAt?: Date } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabledForSubject").mockReturnValue(true);
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    const person = await seedUser({ email: faker.internet.email(), productUpdatesUnsubscribedAt: input.productUpdatesUnsubscribedAt ?? null });

    async function payOnPersonalAccount(amount: number) {
      await container.resolve(StripeTransactionRepository).create({
        userId: person.id,
        organizationId: await seedPersonalOrganizationIdOf(person.id),
        type: "payment_intent",
        status: "succeeded",
        amount,
        currency: "usd"
      });
    }

    function answerNotifications() {
      const sent: SentNotification[] = [];
      nock(notificationsBaseUrl)
        .persist()
        .post(NOTIFICATION_PATH)
        .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
          sent.push({ userId: this.req.headers["x-user-id"] as string | undefined, body: body as SentNotification["body"] });
          return [204];
        });

      return sent;
    }

    async function invite(options: { expectState?: "retry" } = {}) {
      await enqueue(new InviteAffiliate({ userId: person.id }), { singletonKey: inviteAffiliateKeyFor(person.id) });
      await startWorkers();
      if (options.expectState) {
        await expectJobState(options.expectState);
        return;
      }
      await expectJobCompleted(JOB, { singletonKey: inviteAffiliateKeyFor(person.id) });
    }

    async function expectJobState(state: string) {
      await vi.waitFor(
        async () => {
          expect(await findJobRows(JOB, { singletonKey: inviteAffiliateKeyFor(person.id), state })).toHaveLength(1);
        },
        { timeout: 20_000, interval: 250 }
      );
    }

    return { person, payOnPersonalAccount, answerNotifications, invite };
  }
});
