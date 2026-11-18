import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { GpuAvailableNoticeHandler } from "./gpu-available-notice.handler";
import { GpuAvailableNoticeJob } from "./gpu-available-notice.job";

import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";

const jobWorkers = useJobWorkers(() => [container.resolve(GpuAvailableNoticeHandler)]);

describe(GpuAvailableNoticeHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("emails a waiting user whose own wallet is trialing, run the way a worker runs it", async () => {
    const { user, entry, notifications, run } = await setup({ status: "waiting", isTrialing: true });

    await run(entry.id);

    expect(notifications).toMatchObject([
      {
        notificationId: `gpuAvailable.${entry.id}.1`,
        recipient: user.email,
        payload: { summary: "8× H100 80Gi SXM5 is available on Akash", description: expect.stringContaining("Add a payment method to deploy GPUs") }
      }
    ]);
  });

  it("skips an entry that has ended", async () => {
    const { entry, notifications, run } = await setup({ status: "left", isTrialing: false });

    await run(entry.id);

    expect(notifications).toEqual([]);
  });

  async function setup(input: { status: "waiting" | "left"; isTrialing: boolean }) {
    const { user } = await seedUserWithWallet({ isTrialing: input.isTrialing, user: { email: faker.internet.email() } });
    const entry = await seedGpuWaitlistEntry({ userId: user.id, status: input.status, model: "h100", memory: "80Gi", interface: "sxm5", gpuCount: 8 });
    const notifications: Record<string, unknown>[] = [];
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post(NOTIFICATION_PATH)
      .reply(function reply(_uri, body) {
        notifications.push(body as Record<string, unknown>);
        return [204];
      });

    async function run(entryId: string) {
      const { enqueue, startWorkers } = await jobWorkers();
      const singletonKey = faker.string.uuid();
      await enqueue(new GpuAvailableNoticeJob({ entryId, waveNumber: 1, priceUsdPerHour: 2.5 }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(GpuAvailableNoticeJob[JOB_NAME], { singletonKey });
    }

    return { user, entry, notifications, run };
  }
});
