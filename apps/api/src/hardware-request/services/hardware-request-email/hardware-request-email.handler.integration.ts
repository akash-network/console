import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { supportMailboxUserId } from "@src/hardware-request/lib/support-mailbox-user-id/support-mailbox-user-id";
import { HARDWARE_REQUEST_CONFIG } from "@src/hardware-request/providers/config.provider";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { UserRepository } from "@src/user/repositories";
import { HardwareRequestEmailHandler, HardwareRequestEmailJob } from "./hardware-request-email.handler";

import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const DEFAULT_CHANNEL_PATH = "/v1/notification-channels/default";

const jobWorkers = useJobWorkers(() => [container.resolve(HardwareRequestEmailHandler)]);

type SentRequest = { userId: string | undefined; body: Record<string, unknown> };

describe(HardwareRequestEmailHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("emails the request to the support mailbox, run the way a worker runs it", async () => {
    const { hardwareRequest, mailboxEmail, answerNotificationsWith, sendEmailFor } = await setup();
    const notifications = answerNotificationsWith(204);

    await sendEmailFor(hardwareRequest.id);

    expect(notifications).toEqual([
      {
        userId: supportMailboxUserId(mailboxEmail),
        body: {
          notificationId: `hardwareRequest.${hardwareRequest.id}`,
          payload: {
            summary: "GPU request: 8× B200",
            description: expect.stringContaining(`<a href="mailto:${hardwareRequest.contactEmail}">`)
          }
        }
      }
    ]);
  });

  it("opens the support mailbox channel the first time it emails it", async () => {
    const { hardwareRequest, mailboxEmail, notificationsBaseUrl, answerNotificationsWith, sendEmailFor } = await setup();
    const channels: SentRequest[] = [];
    nock(notificationsBaseUrl).post(NOTIFICATION_PATH).reply(400, { code: "NOTIFICATION_CHANNEL_NOT_FOUND", message: "Notification channel not found" });
    nock(notificationsBaseUrl)
      .post(DEFAULT_CHANNEL_PATH)
      .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
        channels.push({ userId: this.req.headers["x-user-id"], body: body as Record<string, unknown> });
        return [204];
      });
    const notifications = answerNotificationsWith(204);

    await sendEmailFor(hardwareRequest.id);

    expect(channels).toEqual([
      {
        userId: supportMailboxUserId(mailboxEmail),
        body: { data: { name: "Default", type: "email", config: { addresses: [mailboxEmail] } } }
      }
    ]);
    expect(notifications).toHaveLength(1);
  });

  it("completes without emailing anyone when the request no longer exists", async () => {
    const { answerNotificationsWith, sendEmailFor } = await setup();
    const notifications = answerNotificationsWith(204);

    await sendEmailFor(faker.string.uuid());

    expect(notifications).toEqual([]);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    const mailboxEmail = container.resolve(HARDWARE_REQUEST_CONFIG).HARDWARE_REQUEST_EMAIL;

    const user = await container.resolve(UserRepository).create({ email: faker.internet.email(), username: `user-${faker.string.alphanumeric(12)}` });
    const hardwareRequest = await container.resolve(HardwareRequestRepository).create({
      userId: user.id,
      category: "gpu_model",
      gpuModel: "B200",
      quantity: 8,
      contactEmail: faker.internet.email()
    });

    function answerNotificationsWith(status: number) {
      const sent: SentRequest[] = [];
      nock(notificationsBaseUrl)
        .persist()
        .post(NOTIFICATION_PATH)
        .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
          sent.push({ userId: this.req.headers["x-user-id"], body: body as Record<string, unknown> });
          return [status];
        });

      return sent;
    }

    async function sendEmailFor(hardwareRequestId: string) {
      await enqueue(new HardwareRequestEmailJob({ hardwareRequestId }));
      await startWorkers();
      await expectJobCompleted(HardwareRequestEmailJob[JOB_NAME], { data: { hardwareRequestId } });
    }

    return { hardwareRequest, mailboxEmail, notificationsBaseUrl, answerNotificationsWith, sendEmailFor };
  }
});
