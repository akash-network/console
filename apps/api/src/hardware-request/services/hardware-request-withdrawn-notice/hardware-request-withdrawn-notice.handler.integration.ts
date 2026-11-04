import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { HARDWARE_REQUEST_CONFIG } from "@src/hardware-request/providers/config.provider";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { HardwareRequestWithdrawnNoticeHandler, HardwareRequestWithdrawnNoticeJob } from "./hardware-request-withdrawn-notice.handler";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [container.resolve(HardwareRequestWithdrawnNoticeHandler)]);

describe(HardwareRequestWithdrawnNoticeHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("emails the shared mailbox about a withdrawn request nobody owns, run the way a worker runs it", async () => {
    const { enqueue, startWorkers } = await jobWorkers();
    const user = await seedUser();
    const hardwareRequest = await seedHardwareRequest({ userId: user.id, owner: null, gpuModel: "H100", quantity: 8 });
    const eventId = faker.string.uuid();
    const notifications: Record<string, unknown>[] = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(function reply(_uri, body) {
        notifications.push(body as Record<string, unknown>);
        return [204];
      });

    await enqueue(new HardwareRequestWithdrawnNoticeJob({ hardwareRequestId: hardwareRequest.id, eventId }), { singletonKey: eventId });
    await startWorkers();
    await expectJobCompleted(HardwareRequestWithdrawnNoticeJob[JOB_NAME], { singletonKey: eventId });

    expect(notifications).toMatchObject([
      { notificationId: `hardwareRequestWithdrawn.${eventId}`, recipient: container.resolve(HARDWARE_REQUEST_CONFIG).HARDWARE_REQUEST_EMAIL }
    ]);
  });
});
