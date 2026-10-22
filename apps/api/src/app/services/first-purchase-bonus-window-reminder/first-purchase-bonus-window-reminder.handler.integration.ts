import { faker } from "@faker-js/faker";
import { addDays, subDays } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { StripeTransactionRepository } from "@src/billing/repositories";
import { FirstPurchaseBonusWinBackRepository } from "@src/billing/repositories/first-purchase-bonus-win-back/first-purchase-bonus-win-back.repository";
import { JOB_NAME } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { createProductUpdateUnsubscribeToken } from "@src/user/lib/product-update-unsubscribe-token/product-update-unsubscribe-token";
import { UserRepository } from "@src/user/repositories";
import { FirstPurchaseBonusWindowReminderHandler } from "./first-purchase-bonus-window-reminder.handler";
import { FirstPurchaseBonusWindowReminderJob, firstPurchaseBonusWindowReminderOptionsFor } from "./first-purchase-bonus-window-reminder.job";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, makeJobDue, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const REMINDER_JOB = FirstPurchaseBonusWindowReminderJob[JOB_NAME];
const UNSUBSCRIBE_SECRET = faker.string.alphanumeric(32);
const SMALL_PURCHASE_CENTS = 20_00;

const jobWorkers = useJobWorkers(() => [container.resolve(FirstPurchaseBonusWindowReminderHandler)]);

type SentNotification = {
  userId: string | undefined;
  body: { notificationId: string; payload: { summary: string; description: string }; unsubscribe?: { url: string; oneClickUrl: string }; recipient?: string };
};

describe(FirstPurchaseBonusWindowReminderHandler.name, () => {
  beforeAll(() => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", UNSUBSCRIBE_SECRET);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("reminds a small first buyer 2 days before the window closes, with a working unsubscribe", async () => {
    const { person, payOnPersonalAccount, answerNotifications, remind } = await setup();
    const firstPayment = await payOnPersonalAccount({ createdAt: subDays(new Date(), 5) });
    const notifications = answerNotifications();

    await remind(firstPayment.createdAt);

    const token = createProductUpdateUnsubscribeToken(UNSUBSCRIBE_SECRET, person.id);
    expect(notifications).toEqual([
      {
        userId: person.id,
        body: expect.objectContaining({
          notificationId: `firstPurchaseBonusWindowReminder.small_first_purchase.${person.id}`,
          payload: expect.objectContaining({ summary: "2 days left to get your first-purchase bonus" }),
          unsubscribe: {
            url: `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/unsubscribe?token=${token}`,
            oneClickUrl: `${container.resolve(CoreConfigService).get("SERVER_ORIGIN")}/v1/product-update-unsubscriptions?token=${token}`
          },
          recipient: person.email
        })
      }
    ]);
  });

  it("reminds nothing to a person who unsubscribed after the window opened", async () => {
    const { person, payOnPersonalAccount, answerNotifications, remind } = await setup();
    const firstPayment = await payOnPersonalAccount({ createdAt: subDays(new Date(), 5) });
    await container.resolve(UserRepository).updateById(person.id, { productUpdatesUnsubscribedAt: new Date() });
    const notifications = answerNotifications();

    await remind(firstPayment.createdAt);

    expect(notifications).toEqual([]);
  });

  it("reminds nothing to a person who earned the bonus since the window opened", async () => {
    const { payOnPersonalAccount, answerNotifications, remind } = await setup();
    const firstPayment = await payOnPersonalAccount({ createdAt: subDays(new Date(), 5) });
    await payOnPersonalAccount({ createdAt: subDays(new Date(), 1), amount: 100_00, bonusAmount: 10_00 });
    const notifications = answerNotifications();

    await remind(firstPayment.createdAt);

    expect(notifications).toEqual([]);
  });

  it("reminds nothing once the window has closed", async () => {
    const { payOnPersonalAccount, answerNotifications, remind } = await setup();
    const firstPayment = await payOnPersonalAccount({ createdAt: subDays(new Date(), 8) });
    const notifications = answerNotifications();

    await remind(firstPayment.createdAt);

    expect(notifications).toEqual([]);
  });

  it("reminds a small buyer on the last day of their gpu win-back", async () => {
    const { person, payOnPersonalAccount, answerNotifications, remindWinBack } = await setup();
    await payOnPersonalAccount({ createdAt: subDays(new Date(), 40) });
    const closesAt = addDays(new Date(), 1);
    await container.resolve(FirstPurchaseBonusWinBackRepository).create({ userId: person.id, openedAt: subDays(closesAt, 7), closesAt });
    const notifications = answerNotifications();

    await remindWinBack(closesAt);

    expect(notifications).toEqual([
      {
        userId: person.id,
        body: expect.objectContaining({
          notificationId: `firstPurchaseBonusWindowReminder.gpu_win_back.${person.id}`,
          payload: expect.objectContaining({ summary: "Last day for your 10% bonus credits" })
        })
      }
    ]);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    const person = await seedUser({ email: faker.internet.email() });

    async function payOnPersonalAccount({
      createdAt,
      amount = SMALL_PURCHASE_CENTS,
      bonusAmount = 0
    }: {
      createdAt: Date;
      amount?: number;
      bonusAmount?: number;
    }) {
      return await container.resolve(StripeTransactionRepository).create({
        userId: person.id,
        type: "payment_intent",
        status: "succeeded",
        amount,
        bonusAmount,
        currency: "usd",
        createdAt
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

    async function runReminder(reminder: FirstPurchaseBonusWindowReminderJob["data"]) {
      const options = firstPurchaseBonusWindowReminderOptionsFor(reminder);
      await enqueue(new FirstPurchaseBonusWindowReminderJob(reminder), options);
      await makeJobDue(REMINDER_JOB, { singletonKey: options.singletonKey });
      await startWorkers();
      await expectJobCompleted(REMINDER_JOB, { singletonKey: options.singletonKey });
    }

    const remind = (paidAt: Date) => runReminder({ userId: person.id, reason: "small_first_purchase", closesAt: addDays(paidAt, 7).toISOString() });
    const remindWinBack = (closesAt: Date) => runReminder({ userId: person.id, reason: "gpu_win_back", closesAt: closesAt.toISOString() });

    return { person, payOnPersonalAccount, answerNotifications, remind, remindWinBack };
  }
});
