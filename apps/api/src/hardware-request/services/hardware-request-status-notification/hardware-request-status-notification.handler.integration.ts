import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { PurgeExpiredActivitiesHandler } from "@src/activity/services/purge-expired-activities/purge-expired-activities.handler";
import { JOB_NAME } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { HardwareRequestStatusNotificationHandler, HardwareRequestStatusNotificationJob } from "./hardware-request-status-notification.handler";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [container.resolve(HardwareRequestStatusNotificationHandler), container.resolve(PurgeExpiredActivitiesHandler)]);

describe(HardwareRequestStatusNotificationHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("adds the change to the requester's activity feed and emails them, run the way a worker runs it", async () => {
    const { user, organization, hardwareRequest, notifications, notify } = await setup();
    const eventId = faker.string.uuid();

    await notify({ hardwareRequestId: hardwareRequest.id, eventId, status: "sourcing" });

    expect(await container.resolve(ActivityRepository).find({ userId: user.id })).toMatchObject([
      {
        organizationId: organization.id,
        type: "gpu_request_update",
        status: "info",
        initiator: "system",
        meta: { hardwareRequestId: hardwareRequest.id, hardwareRequestStatus: "sourcing", summary: "GPU request: 8× H100 is being sourced" },
        dedupeKey: `gpuRequestStatus:${eventId}`
      }
    ]);
    expect(notifications).toEqual([
      {
        notificationId: `gpuRequestStatus.${eventId}`,
        payload: {
          summary: "GPU request: 8× H100 is being sourced",
          description: "We're reaching out to providers for capacity that matches your request.",
          actions: [
            { label: "View request", url: `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/gpu-requests/${hardwareRequest.id}` }
          ]
        },
        recipient: user.email
      }
    ]);
  });

  it("adds a retried change to the feed once", async () => {
    const { user, hardwareRequest, notify } = await setup();
    const eventId = faker.string.uuid();

    await notify({ hardwareRequestId: hardwareRequest.id, eventId, status: "closed", closeReason: "price" }, "first-attempt");
    await notify({ hardwareRequestId: hardwareRequest.id, eventId, status: "closed", closeReason: "price" }, "second-attempt");

    expect(await container.resolve(ActivityRepository).find({ userId: user.id })).toHaveLength(1);
  });

  it("emails the contact address of a request filed for an email with no account", async () => {
    const { notifications, notify } = await setup();
    const unclaimed = await seedHardwareRequest({ userId: null, contactEmail: "lead@example.com", gpuModel: "H100", quantity: 8 });
    const eventId = faker.string.uuid();

    await notify({ hardwareRequestId: unclaimed.id, eventId, status: "sourcing" });

    expect(notifications).toMatchObject([{ notificationId: `gpuRequestStatus.${eventId}`, recipient: "lead@example.com" }]);
  });

  it("completes without telling anyone when the request no longer exists", async () => {
    const { notifications, notify } = await setup();

    await notify({ hardwareRequestId: faker.string.uuid(), eventId: faker.string.uuid(), status: "sourcing" });

    expect(notifications).toEqual([]);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user, organization } = await seedOrganizationWithOwner({ user: { email: faker.internet.email(), userId: faker.string.uuid() } });
    const hardwareRequest = await seedHardwareRequest({ userId: user.id, organizationId: organization.id, gpuModel: "H100", quantity: 8 });

    const notifications: Record<string, unknown>[] = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(function reply(_uri, body) {
        notifications.push(body as Record<string, unknown>);
        return [204];
      });

    async function notify(data: HardwareRequestStatusNotificationJob["data"], singletonKey = data.eventId) {
      await enqueue(new HardwareRequestStatusNotificationJob(data), { singletonKey });
      await startWorkers();
      await expectJobCompleted(HardwareRequestStatusNotificationJob[JOB_NAME], { singletonKey });
    }

    return { user, organization, hardwareRequest, notifications, notify };
  }
});
