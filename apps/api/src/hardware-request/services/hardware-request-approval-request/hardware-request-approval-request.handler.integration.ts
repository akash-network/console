import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { HardwareRequestOfferRepository } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { HardwareRequestApprovalRequestHandler, HardwareRequestApprovalRequestJob } from "./hardware-request-approval-request.handler";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [container.resolve(HardwareRequestApprovalRequestHandler)]);

describe(HardwareRequestApprovalRequestHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("emails the organization's owners and admins, and no one else, run the way a worker runs it", async () => {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user: owner, organization } = await seedOrganizationWithOwner({ user: { email: faker.internet.email() } });
    const [admin, requester] = await Promise.all([seedUser({ email: faker.internet.email() }), seedUser({ email: faker.internet.email() })]);
    await Promise.all([
      seedOrganizationMember({ organizationId: organization.id, userId: admin.id, role: "admin" }),
      seedOrganizationMember({ organizationId: organization.id, userId: requester.id, role: "member" })
    ]);
    const hardwareRequest = await seedHardwareRequest({ userId: requester.id, organizationId: organization.id, status: "offers" });
    const offer = await container.resolve(HardwareRequestOfferRepository).create({
      hardwareRequestId: hardwareRequest.id,
      status: "published",
      providerAddress: "akash1provider",
      providerAudited: true,
      providerUptime7d: 0.99,
      usdPerGpuHour: 2.4,
      terms: {
        gpu: { model: "H100", count: 8, interconnect: "server" },
        location: "Frankfurt, DE",
        availableFrom: "2026-12-01",
        term: "6_months",
        sla: null,
        storage: { tbPerNode: 4, nvme: true },
        uplinkGbps: null
      },
      expiresAt: new Date(Date.now() + 60_000)
    });
    const eventId = faker.string.uuid();
    const notifications: Record<string, unknown>[] = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(function reply(_uri, body) {
        notifications.push(body as Record<string, unknown>);
        return [204];
      });

    await enqueue(
      new HardwareRequestApprovalRequestJob({ hardwareRequestId: hardwareRequest.id, offerId: offer.id, eventId, requestedByUserId: requester.id }),
      { singletonKey: eventId }
    );
    await startWorkers();
    await expectJobCompleted(HardwareRequestApprovalRequestJob[JOB_NAME], { singletonKey: eventId });

    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ notificationId: `gpuOfferApprovalRequest.${eventId}.${owner.id}`, recipient: owner.email }),
        expect.objectContaining({ notificationId: `gpuOfferApprovalRequest.${eventId}.${admin.id}`, recipient: admin.email })
      ])
    );
  });
});
