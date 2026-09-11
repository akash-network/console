import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { addDays, subDays } from "date-fns";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { TrialStarted } from "@src/billing/events/trial-started";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { JOB_NAME } from "@src/core";
import { DOMAIN_EVENT_NAME } from "@src/core/services/domain-events/domain-events.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { NotificationHandler, NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { UserRepository } from "@src/user/repositories";
import { TrialStartedHandler } from "./trial-started.handler";

import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [container.resolve(TrialStartedHandler), container.resolve(NotificationHandler)]);

describe(TrialStartedHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("schedules the whole trial email sequence off the day the user was created", async () => {
    const { userId, trialEndsAt, expirationDays, handle, findNotificationJobs } = await setup();

    await handle();

    const scheduled = await findNotificationJobs(userId);
    expect(scheduled).toEqual([
      { singleton_key: `notification.beforeTrialEnds.${userId}.${expirationDays - 7}`, startAfter: subDays(trialEndsAt, 7) },
      { singleton_key: `notification.beforeTrialEnds.${userId}.${expirationDays - 1}`, startAfter: subDays(trialEndsAt, 1) },
      { singleton_key: `notification.trialEnded.${userId}`, startAfter: trialEndsAt },
      { singleton_key: `notification.afterTrialEnds.${userId}.${expirationDays + 7}`, startAfter: addDays(trialEndsAt, 7) }
    ]);
  });

  it("sends the welcome email straight away", async () => {
    const { handle, sentNotifications } = await setup();

    await handle();

    expect(sentNotifications()).toHaveLength(1);
  });

  it("still schedules the sequence for a user with no email to welcome", async () => {
    const { userId, handle, findNotificationJobs, sentNotifications } = await setup({ email: null });

    await handle();

    expect(sentNotifications()).toHaveLength(0);
    expect(await findNotificationJobs(userId)).toHaveLength(4);
  });

  it("schedules nothing for a user who no longer exists", async () => {
    const { handle, findNotificationJobs } = await setup();
    const strangerId = faker.string.uuid();

    await handle(strangerId);

    expect(await findNotificationJobs(strangerId)).toHaveLength(0);
  });

  async function setup(input: { email?: string | null } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const billingConfig = container.resolve(BillingConfigService);
    const expirationDays = billingConfig.get("TRIAL_ALLOWANCE_EXPIRATION_DAYS");
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;

    const email = input.email === undefined ? faker.internet.email() : input.email;
    const user = await container.resolve(UserRepository).create({ email });

    const sent: unknown[] = [];
    nock(notificationsBaseUrl)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
        sent.push(body);

        return [201, {}];
      });

    async function findNotificationJobs(userId: string) {
      const rows = await findJobRows(NotificationJob[JOB_NAME], { singletonKeyLike: `%.${userId}%` });

      return rows
        .map(row => ({ singleton_key: row.singleton_key, startAfter: new Date(row.start_after) }))
        .sort((a, b) => a.startAfter.getTime() - b.startAfter.getTime());
    }

    return {
      userId: user.id,
      expirationDays,
      trialEndsAt: addDays(user.createdAt!, expirationDays),
      sentNotifications: () => sent,
      findNotificationJobs,
      handle: async (userId: string = user.id) => {
        await enqueue(new TrialStarted({ userId }));
        await startWorkers();
        await expectJobCompleted(TrialStarted[DOMAIN_EVENT_NAME], { data: { userId } });
      }
    };
  }
});
