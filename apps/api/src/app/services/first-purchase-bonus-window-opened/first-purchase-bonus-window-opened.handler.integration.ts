import { faker } from "@faker-js/faker";
import { addDays, subHours } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { FirstPurchaseBonusWindowOpened } from "@src/billing/events/first-purchase-bonus-window-opened";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { JOB_NAME } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { createProductUpdateUnsubscribeToken } from "@src/user/lib/product-update-unsubscribe-token/product-update-unsubscribe-token";
import { FirstPurchaseBonusWindowReminderHandler } from "../first-purchase-bonus-window-reminder/first-purchase-bonus-window-reminder.handler";
import { FirstPurchaseBonusWindowReminderJob } from "../first-purchase-bonus-window-reminder/first-purchase-bonus-window-reminder.job";
import { FirstPurchaseBonusWindowOpenedHandler } from "./first-purchase-bonus-window-opened.handler";

import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const WINDOW_OPENED_EVENT = FirstPurchaseBonusWindowOpened[JOB_NAME];
const REMINDER_JOB = FirstPurchaseBonusWindowReminderJob[JOB_NAME];
const UNSUBSCRIBE_SECRET = faker.string.alphanumeric(32);
const SMALL_PURCHASE_CENTS = 20_00;

const jobWorkers = useJobWorkers(() => [container.resolve(FirstPurchaseBonusWindowOpenedHandler), container.resolve(FirstPurchaseBonusWindowReminderHandler)]);

type SentNotification = {
  userId: string | undefined;
  body: { notificationId: string; payload: { summary: string; description: string }; unsubscribe?: { url: string; oneClickUrl: string }; recipient?: string };
};

describe(FirstPurchaseBonusWindowOpenedHandler.name, () => {
  beforeAll(() => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", UNSUBSCRIBE_SECRET);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("emails a small first buyer that the bonus is open until 7 days after they paid, with a working unsubscribe", async () => {
    const { person, payOnPersonalAccount, answerNotifications, announce } = await setup();
    const firstPayment = await payOnPersonalAccount({ createdAt: subHours(new Date(), 1) });
    const notifications = answerNotifications();

    await announce(firstPayment.createdAt);

    const token = createProductUpdateUnsubscribeToken(UNSUBSCRIBE_SECRET, person.id);
    expect(notifications).toEqual([
      {
        userId: person.id,
        body: expect.objectContaining({
          notificationId: `firstPurchaseBonusWindowOpened.small_first_purchase.${person.id}`,
          payload: expect.objectContaining({ summary: "Your first-purchase bonus is still available" }),
          unsubscribe: {
            url: `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/unsubscribe?token=${token}`,
            oneClickUrl: `${container.resolve(CoreConfigService).get("SERVER_ORIGIN")}/v1/product-update-unsubscriptions?token=${token}`
          },
          recipient: person.email
        })
      }
    ]);
  });

  it("schedules the reminder for 5 days after the first purchase", async () => {
    const { person, payOnPersonalAccount, answerNotifications, announce } = await setup();
    const firstPayment = await payOnPersonalAccount({ createdAt: subHours(new Date(), 1) });
    answerNotifications();

    await announce(firstPayment.createdAt);

    const reminders = await findJobRows(REMINDER_JOB, { singletonKey: `firstPurchaseBonusWindowReminder.small_first_purchase.${person.id}` });
    expect(reminders.map(({ state, data, start_after }) => ({ state, data, startAfter: new Date(start_after) }))).toEqual([
      {
        state: "created",
        data: { userId: person.id, reason: "small_first_purchase", closesAt: addDays(firstPayment.createdAt, 7).toISOString(), version: 1 },
        startAfter: addDays(firstPayment.createdAt, 5)
      }
    ]);
  });

  it("emails nothing and schedules no reminder to a person who received the bonus on a team", async () => {
    const { person, payOnPersonalAccount, answerNotifications, announce } = await setup();
    const { organization: team } = await seedOrganizationWithOwner();
    await container.resolve(StripeTransactionRepository).create({
      userId: person.id,
      organizationId: team.id,
      type: "payment_intent",
      status: "succeeded",
      amount: 100_00,
      bonusAmount: 10_00,
      currency: "usd"
    });
    const firstPayment = await payOnPersonalAccount({ createdAt: subHours(new Date(), 1) });
    const notifications = answerNotifications();

    await announce(firstPayment.createdAt);

    expect(notifications).toEqual([]);
    expect(await findJobRows(REMINDER_JOB, { data: { userId: person.id } })).toEqual([]);
  });

  it("emails nothing to a person who opted out of product update emails, but keeps the reminder for their live preference", async () => {
    const { person, payOnPersonalAccount, answerNotifications, announce } = await setup({ productUpdatesUnsubscribedAt: new Date() });
    const firstPayment = await payOnPersonalAccount({ createdAt: subHours(new Date(), 1) });
    const notifications = answerNotifications();

    await announce(firstPayment.createdAt);

    expect(notifications).toEqual([]);
    expect(await findJobRows(REMINDER_JOB, { data: { userId: person.id } })).toHaveLength(1);
  });

  it("emails a person who never paid the gpu win-back without a date and schedules no reminder", async () => {
    const { person, answerNotifications, announceWithoutDeadline } = await setup();
    const notifications = answerNotifications();

    await announceWithoutDeadline();

    expect(notifications).toEqual([
      {
        userId: person.id,
        body: expect.objectContaining({
          notificationId: `firstPurchaseBonusWindowOpened.gpu_win_back.${person.id}`,
          payload: expect.objectContaining({ summary: "Your first purchase comes with bonus credits" })
        })
      }
    ]);
    expect(await findJobRows(REMINDER_JOB, { data: { userId: person.id } })).toEqual([]);
  });

  it("emails nothing about a win-back without a date to a person who paid since", async () => {
    const { payOnPersonalAccount, answerNotifications, announceWithoutDeadline } = await setup();
    await payOnPersonalAccount({ createdAt: subHours(new Date(), 1) });
    const notifications = answerNotifications();

    await announceWithoutDeadline();

    expect(notifications).toEqual([]);
  });

  async function setup(input: { productUpdatesUnsubscribedAt?: Date } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    const person = await seedUser({ email: faker.internet.email(), productUpdatesUnsubscribedAt: input.productUpdatesUnsubscribedAt ?? null });

    async function payOnPersonalAccount({ createdAt }: { createdAt: Date }) {
      return await container.resolve(StripeTransactionRepository).create({
        userId: person.id,
        type: "payment_intent",
        status: "succeeded",
        amount: SMALL_PURCHASE_CENTS,
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

    async function announce(paidAt: Date) {
      await enqueue(new FirstPurchaseBonusWindowOpened({ userId: person.id, reason: "small_first_purchase", closesAt: addDays(paidAt, 7).toISOString() }));
      await startWorkers();
      await expectJobCompleted(WINDOW_OPENED_EVENT, { data: { userId: person.id } });
    }

    async function announceWithoutDeadline() {
      await enqueue(new FirstPurchaseBonusWindowOpened({ userId: person.id, reason: "gpu_win_back", closesAt: null }));
      await startWorkers();
      await expectJobCompleted(WINDOW_OPENED_EVENT, { data: { userId: person.id } });
    }

    return { person, payOnPersonalAccount, answerNotifications, announce, announceWithoutDeadline };
  }
});
