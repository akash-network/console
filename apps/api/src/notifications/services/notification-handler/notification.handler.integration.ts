import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { NotificationHandler, NotificationJob } from "./notification.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [container.resolve(NotificationHandler)]);

describe(NotificationHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("sends the notification a user still on trial earns", async () => {
    const { userId, dseq, notificationId, notify, sentNotifications } = await setup({ isTrialing: true });

    await notify();

    const [sent] = sentNotifications();
    expect(sent.userId).toBe(userId);
    expect(sent.body).toMatchObject({ notificationId });
    expect(JSON.stringify(sent.body)).toContain(dseq);
  });

  it("sends the notification to a user who has no wallet yet", async () => {
    const { notify, sentNotifications } = await setup({ withWallet: false });

    await notify();

    expect(sentNotifications()).toHaveLength(1);
  });

  it("skips a user whose wallet has left the trial", async () => {
    const { notify, sentNotifications } = await setup({ isTrialing: false });

    await notify();

    expect(sentNotifications()).toHaveLength(0);
  });

  it("skips a user with no email to send to", async () => {
    const { notify, sentNotifications } = await setup({ isTrialing: true, email: null });

    await notify();

    expect(sentNotifications()).toHaveLength(0);
  });

  async function setup(input: { isTrialing?: boolean; withWallet?: boolean; email?: string | null } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;

    const email = input.email === undefined ? faker.internet.email() : input.email;
    const user =
      input.withWallet === false ? await seedUser({ email }) : (await seedUserWithWallet({ isTrialing: input.isTrialing ?? true, user: { email } })).user;

    const dseq = faker.string.numeric(6);
    const owner = createAkashAddress();
    const notificationId = `trialFirstDeploymentLeaseCreated.${owner}`;

    const sent: { userId: string | undefined; body: Record<string, unknown> }[] = [];
    nock(notificationsBaseUrl)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
        sent.push({ userId: this.req.headers["x-user-id"] as string, body: body as Record<string, unknown> });

        return [201, {}];
      });

    return {
      userId: user.id,
      dseq,
      owner,
      notificationId,
      sentNotifications: () => sent,
      notify: async () => {
        await enqueue(
          new NotificationJob({
            template: "trialFirstDeploymentLeaseCreated",
            userId: user.id,
            conditions: { trial: true },
            vars: { dseq, owner }
          }),
          { singletonKey: notificationId }
        );
        await startWorkers();
        await expectJobCompleted(NotificationJob[JOB_NAME], { singletonKey: notificationId });
      }
    };
  }
});
