import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { HARDWARE_REQUEST_CONFIG } from "@src/hardware-request/providers/config.provider";
import { HardwareRequestOfferRepository } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { HardwareRequestAcceptedNoticeHandler, HardwareRequestAcceptedNoticeJob } from "./hardware-request-accepted-notice.handler";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [container.resolve(HardwareRequestAcceptedNoticeHandler)]);

describe(HardwareRequestAcceptedNoticeHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("emails the shared mailbox about an accepted offer on a request nobody owns, run the way a worker runs it", async () => {
    const { enqueue, startWorkers } = await jobWorkers();
    const user = await seedUser();
    const hardwareRequest = await seedHardwareRequest({ userId: user.id, owner: null, gpuModel: "H100", quantity: 8 });
    const offer = await container.resolve(HardwareRequestOfferRepository).create({
      hardwareRequestId: hardwareRequest.id,
      status: "accepted",
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

    await enqueue(new HardwareRequestAcceptedNoticeJob({ hardwareRequestId: hardwareRequest.id, offerId: offer.id, eventId, acceptedByUserId: user.id }), {
      singletonKey: eventId
    });
    await startWorkers();
    await expectJobCompleted(HardwareRequestAcceptedNoticeJob[JOB_NAME], { singletonKey: eventId });

    expect(notifications).toMatchObject([
      { notificationId: `hardwareRequestAccepted.${eventId}`, recipient: container.resolve(HARDWARE_REQUEST_CONFIG).HARDWARE_REQUEST_EMAIL }
    ]);
  });
});
