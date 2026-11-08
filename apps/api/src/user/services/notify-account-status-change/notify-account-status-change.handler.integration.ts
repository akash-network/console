import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import type { AccountStatusAction } from "@src/user/lib/account-status/account-status";
import type { AccountStatusEventInput } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { NotifyAccountStatusChangeHandler } from "./notify-account-status-change.handler";
import { NOTIFY_ACCOUNT_STATUS_CHANGE_RETRY_OPTIONS, NotifyAccountStatusChange, notifyAccountStatusChangeKeyFor } from "./notify-account-status-change.job";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, makeJobDue, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const JOB = NotifyAccountStatusChange[JOB_NAME];
const INTERNAL_NOTE = "Chargeback on card, do not tell the user";

const jobWorkers = useJobWorkers(() => [container.resolve(NotifyAccountStatusChangeHandler)]);

type SentNotification = { userId: string | undefined; body: { notificationId: string; recipient: string; payload: { summary: string; description: string } } };

describe(NotifyAccountStatusChangeHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it.each([
    {
      action: "suspend" as const,
      options: { closeDeployments: true },
      summary: "Your Akash Console account is suspended",
      mentions: "We're also closing the deployments that were running on it."
    },
    {
      action: "reinstate" as const,
      options: {},
      summary: "Your Akash Console account is active again",
      mentions: "Everything works as it did before"
    },
    {
      action: "terminate" as const,
      options: { forfeitCredits: true, emailVerified: true },
      summary: "Your Akash Console account has been terminated",
      mentions: "The credits left on the account are forfeited and won't be refunded."
    }
  ])("sends one notification about a $action to the user and marks it sent", async ({ action, options, summary, mentions }) => {
    const { user, recordEvent, answerNotifications, run, findEvent } = await setup();
    const event = await recordEvent({ action, options });
    const notifications = answerNotifications();

    await run(event.id);

    expect(notifications.sent).toEqual([
      {
        userId: user.id,
        body: expect.objectContaining({
          notificationId: expect.stringMatching(new RegExp(`\\.${event.id}$`)),
          recipient: user.email,
          payload: expect.objectContaining({ summary, description: expect.stringContaining(mentions) })
        })
      }
    ]);
    expect((await findEvent(event.id)).notificationSentAt).toBeInstanceOf(Date);
  });

  it("includes the user reason and never the internal note", async () => {
    const { recordEvent, answerNotifications, run } = await setup();
    const event = await recordEvent({ action: "suspend", options: { closeDeployments: false } });
    const notifications = answerNotifications();

    await run(event.id);

    expect(notifications.sent[0].body.payload.description).toContain("<p><strong>Reason:</strong> Unpaid invoices</p>");
    expect(JSON.stringify(notifications.sent)).not.toContain(INTERNAL_NOTE);
  });

  it("keeps the credits in the termination email when the admin did not forfeit them", async () => {
    const { recordEvent, answerNotifications, run } = await setup();
    const event = await recordEvent({ action: "terminate", options: { forfeitCredits: false, emailVerified: true } });
    const notifications = answerNotifications();

    await run(event.id);

    expect(notifications.sent[0].body.payload.description).toContain("The credits left on the account stay there, but you can't spend them.");
  });

  it("leaves the deployments out of the suspension email when the admin kept them running", async () => {
    const { recordEvent, answerNotifications, run } = await setup();
    const event = await recordEvent({ action: "suspend", options: { closeDeployments: false } });
    const notifications = answerNotifications();

    await run(event.id);

    expect(notifications.sent[0].body.payload.description).not.toContain("closing the deployments");
  });

  it("sends to a user who unsubscribed from product updates", async () => {
    const { recordEvent, answerNotifications, run } = await setup({ productUpdatesUnsubscribedAt: new Date() });
    const event = await recordEvent({ action: "suspend", options: { closeDeployments: false } });
    const notifications = answerNotifications();

    await run(event.id);

    expect(notifications.sent).toHaveLength(1);
  });

  it("does not send twice when the event is already marked sent", async () => {
    const { recordEvent, answerNotifications, run, findEvent } = await setup();
    const sentAt = new Date("2026-11-01T10:00:00.000Z");
    const event = await recordEvent({ action: "suspend", options: { closeDeployments: false }, notificationSentAt: sentAt });
    const notifications = answerNotifications();

    await run(event.id);

    expect(notifications.sent).toEqual([]);
    expect((await findEvent(event.id)).notificationSentAt).toEqual(sentAt);
  });

  it("skips a user deleted after being reinstated", async () => {
    const { user, db, recordEvent, answerNotifications, run, findEvent } = await setup();
    const event = await recordEvent({ action: "reinstate", options: {} });
    const users = resolveTable("Users");
    await db.delete(users).where(eq(users.id, user.id));
    const notifications = answerNotifications();

    await run(event.id);

    expect(notifications.sent).toEqual([]);
    expect(await findEvent(event.id)).toMatchObject({ userId: null, notificationSentAt: null });
  });

  it("skips a user without an email address", async () => {
    const { recordEvent, answerNotifications, run, findEvent } = await setup({ email: null });
    const event = await recordEvent({ action: "suspend", options: { closeDeployments: false } });
    const notifications = answerNotifications();

    await run(event.id);

    expect(notifications.sent).toEqual([]);
    expect((await findEvent(event.id)).notificationSentAt).toBeNull();
  });

  it("completes without sending for an event that does not exist", async () => {
    const { answerNotifications, run } = await setup();
    const notifications = answerNotifications();

    await run(faker.string.uuid());

    expect(notifications.sent).toEqual([]);
  });

  it("retries a failed send and then emails the user once", async () => {
    const { recordEvent, answerNotifications, enqueue, startWorkers, findEvent } = await setup();
    const event = await recordEvent({ action: "suspend", options: { closeDeployments: false } });
    const notifications = answerNotifications();
    notifications.isUp = false;
    const selector = { data: { eventId: event.id } };

    await enqueue(event.id);
    await startWorkers();
    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(JOB, selector);
        expect(row.state).toBe("retry");
      },
      { timeout: 20_000, interval: 250 }
    );
    expect(notifications.sent).toEqual([]);
    expect((await findEvent(event.id)).notificationSentAt).toBeNull();

    notifications.isUp = true;
    await makeJobDue(JOB, selector);
    await expectJobCompleted(JOB, selector);

    expect(notifications.sent).toHaveLength(1);
    expect((await findEvent(event.id)).notificationSentAt).toBeInstanceOf(Date);
  });

  async function setup(userOverrides: { email?: string | null; productUpdatesUnsubscribedAt?: Date } = {}) {
    const { enqueue: enqueueJob, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    const repository = container.resolve(AccountStatusEventRepository);
    const user = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email(), ...userOverrides });

    async function recordEvent(input: { action: AccountStatusAction; options: AccountStatusEventInput["options"]; notificationSentAt?: Date }) {
      return await repository.create({
        userId: user.id,
        userEmail: user.email,
        action: input.action,
        actorStaffId: faker.string.uuid(),
        actorEmail: faker.internet.email(),
        actorName: faker.person.fullName(),
        userReason: input.action === "reinstate" ? null : "Unpaid invoices",
        internalNote: INTERNAL_NOTE,
        options: input.options,
        notificationSentAt: input.notificationSentAt ?? null
      });
    }

    async function findEvent(id: string) {
      const events = resolveTable("AccountStatusEvents");
      const [event] = await db.select().from(events).where(eq(events.id, id));
      return event;
    }

    function answerNotifications() {
      const state = { sent: [] as SentNotification[], isUp: true };
      nock(notificationsBaseUrl)
        .persist()
        .post(NOTIFICATION_PATH)
        .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
          if (!state.isUp) return [503];
          state.sent.push({ userId: this.req.headers["x-user-id"] as string | undefined, body: body as SentNotification["body"] });
          return [204];
        });

      return state;
    }

    async function enqueue(eventId: string) {
      await enqueueJob(new NotifyAccountStatusChange({ eventId }), {
        singletonKey: notifyAccountStatusChangeKeyFor(eventId),
        ...NOTIFY_ACCOUNT_STATUS_CHANGE_RETRY_OPTIONS
      });
    }

    async function run(eventId: string) {
      await enqueue(eventId);
      await startWorkers();
      await expectJobCompleted(JOB, { data: { eventId } });
    }

    return { user, db, recordEvent, findEvent, answerNotifications, enqueue, startWorkers, run };
  }
});
