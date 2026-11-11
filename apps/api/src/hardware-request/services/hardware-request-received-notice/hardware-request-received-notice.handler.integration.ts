import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { HardwareRequestReceivedNoticeHandler, HardwareRequestReceivedNoticeJob } from "./hardware-request-received-notice.handler";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [container.resolve(HardwareRequestReceivedNoticeHandler)]);

type SentNotification = { userId: string | undefined; body: Record<string, unknown> };

describe(HardwareRequestReceivedNoticeHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("emails the requester a confirmation with the promised reply time, run the way a worker runs it", async () => {
    const { user, seedRequest, notifications, confirm } = await setup();
    const hardwareRequest = await seedRequest({ lane: "sales", firstReplyDueAt: new Date("2026-11-12T18:00:00.000Z") });

    await confirm(hardwareRequest.id);

    expect(notifications).toEqual([
      {
        userId: user.id,
        body: {
          notificationId: `gpuRequestReceived.${hardwareRequest.id}`,
          payload: {
            summary: "GPU request: 8× B200 was received",
            description: "Our team will reply by Thursday, November 12 at 1:00 PM EST.",
            actions: [
              { label: "View request", url: `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/gpu-requests/${hardwareRequest.id}` }
            ]
          },
          recipient: user.email
        }
      }
    ]);
  });

  it("emails the contact address of a request filed for an email with no account", async () => {
    const { notifications, confirm } = await setup();
    const unclaimed = await seedHardwareRequest({ userId: null, contactEmail: "lead@example.com", gpuModel: "H100", quantity: 8 });

    await confirm(unclaimed.id);

    expect(notifications).toMatchObject([
      { userId: emailRecipientUserId("lead@example.com"), body: { notificationId: `gpuRequestReceived.${unclaimed.id}`, recipient: "lead@example.com" } }
    ]);
  });

  it("completes without emailing anyone when the request no longer exists", async () => {
    const { notifications, confirm } = await setup();

    await confirm(faker.string.uuid());

    expect(notifications).toEqual([]);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user, organization } = await seedOrganizationWithOwner({ user: { email: faker.internet.email(), userId: faker.string.uuid() } });
    const seedRequest = (overrides: Omit<Parameters<typeof seedHardwareRequest>[0], "userId">) =>
      seedHardwareRequest({ userId: user.id, organizationId: organization.id, gpuModel: "B200", quantity: 8, ...overrides });

    const notifications: SentNotification[] = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
        notifications.push({ userId: this.req.headers["x-user-id"], body: body as Record<string, unknown> });
        return [204];
      });

    async function confirm(hardwareRequestId: string) {
      await enqueue(new HardwareRequestReceivedNoticeJob({ hardwareRequestId }));
      await startWorkers();
      await expectJobCompleted(HardwareRequestReceivedNoticeJob[JOB_NAME], { data: { hardwareRequestId } });
    }

    return { user, seedRequest, notifications, confirm };
  }
});
