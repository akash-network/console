import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { GpuWaitlistNetworkService } from "@src/gpu-waitlist/services/gpu-waitlist-network/gpu-waitlist-network.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { AskStillWantedHandler } from "./ask-still-wanted.handler";
import { AskStillWanted } from "./ask-still-wanted.job";
import { ExpireGpuAlertHandler } from "./expire-gpu-alert.handler";
import { ExpireGpuAlert } from "./expire-gpu-alert.job";

import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

vi.hoisted(() => {
  process.env.GPU_WAITLIST_NETWORKS = "mainnet,testnet,sandbox";
});

const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const DAY_MS = 24 * 60 * 60 * 1000;

const jobWorkers = useJobWorkers(() => [container.resolve(AskStillWantedHandler), container.resolve(ExpireGpuAlertHandler)]);

describe(AskStillWantedHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("emails a waiting user, records the question and schedules the expiry a grace period out, run the way a worker runs it", async () => {
    const { entry, notifications, run, findEntry } = await setup({ status: "waiting" });

    await run(entry.id);

    const asked = await findEntry(entry.id);
    expect(notifications).toMatchObject([
      {
        notificationId: `gpuStillWanted.${entry.id}.${asked?.stillWantedAskedAt?.getTime()}`,
        payload: {
          summary: "Still want 8× H100 80Gi SXM5?",
          actions: [
            { label: "Keep this alert", url: expect.stringContaining(`keepAlert=${entry.id}`) },
            { label: "Stop these alerts", url: expect.stringContaining(`leaveAlert=${entry.id}`) }
          ]
        }
      }
    ]);
    expect(asked?.stillWantedAskedAt).toBeInstanceOf(Date);
    const [expiry] = (await findJobRows<{ entryId: string }>(ExpireGpuAlert[JOB_NAME])).filter(row => row.data.entryId === entry.id);
    expect(new Date(expiry.start_after).getTime() - (asked?.stillWantedAskedAt?.getTime() ?? 0)).toBe(7 * DAY_MS);
  });

  it("skips an entry that has ended", async () => {
    const { entry, notifications, run, findEntry } = await setup({ status: "left" });

    await run(entry.id);

    expect(notifications).toEqual([]);
    expect((await findEntry(entry.id))?.stillWantedAskedAt).toBeNull();
  });

  it("skips an entry that was already asked", async () => {
    const askedAt = new Date(Date.now() - DAY_MS);
    const { entry, notifications, run, findEntry } = await setup({ status: "waiting", stillWantedAskedAt: askedAt });

    await run(entry.id);

    expect(notifications).toEqual([]);
    expect((await findEntry(entry.id))?.stillWantedAskedAt).toEqual(askedAt);
  });

  it("sends one email when two jobs ask about the same entry", async () => {
    const { entry, notifications, runMany } = await setup({ status: "waiting" });

    await runMany(entry.id, 2);

    expect(notifications).toHaveLength(1);
    const expiries = await findJobRows<{ entryId: string }>(ExpireGpuAlert[JOB_NAME]);
    expect(expiries.filter(row => row.data.entryId === entry.id)).toHaveLength(1);
  });

  it("sends nothing and asks again a day later while the flag is off", async () => {
    const { entry, notifications, run, findEntry } = await setup({ status: "waiting", flagOn: false });

    await run(entry.id);

    expect(notifications).toEqual([]);
    expect((await findEntry(entry.id))?.stillWantedAskedAt).toBeNull();
    const rows = await findJobRows<{ entryId: string }>(AskStillWanted[JOB_NAME], { state: "created" });
    const [next] = rows.filter(row => row.data.entryId === entry.id);
    expect(new Date(next.start_after).getTime() - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  it("sends nothing and asks nothing again on a network that does not serve gpu waitlists", async () => {
    const { entry, notifications, run, findEntry } = await setup({ status: "waiting" });
    vi.spyOn(container.resolve(GpuWaitlistNetworkService), "servesGpuWaitlists").mockReturnValue(false);

    await run(entry.id);

    expect(notifications).toEqual([]);
    expect((await findEntry(entry.id))?.stillWantedAskedAt).toBeNull();
    const rows = await findJobRows<{ entryId: string }>(AskStillWanted[JOB_NAME], { state: "created" });
    expect(rows.filter(row => row.data.entryId === entry.id)).toEqual([]);
  });

  it("asks again later for nothing when the flag is off and the entry has already ended", async () => {
    const { entry, run } = await setup({ status: "left", flagOn: false });

    await run(entry.id);

    const rows = await findJobRows<{ entryId: string }>(AskStillWanted[JOB_NAME], { state: "created" });
    expect(rows.filter(row => row.data.entryId === entry.id)).toEqual([]);
  });

  async function setup(input: { status: "waiting" | "left"; stillWantedAskedAt?: Date; flagOn?: boolean }) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(
      flag => (input.flagOn ?? true) || flag !== FeatureFlags.GPU_AVAILABILITY_ALERTS
    );
    const user = await seedUser({ email: faker.internet.email() });
    const entry = await seedGpuWaitlistEntry({
      userId: user.id,
      status: input.status,
      stillWantedAskedAt: input.stillWantedAskedAt,
      model: "h100",
      memory: "80Gi",
      interface: "sxm5",
      gpuCount: 8
    });
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
      await enqueue(new AskStillWanted({ entryId }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(AskStillWanted[JOB_NAME], { singletonKey });
    }

    async function runMany(entryId: string, times: number) {
      const { enqueue, startWorkers } = await jobWorkers();
      const singletonKeys = Array.from({ length: times }, () => faker.string.uuid());
      for (const singletonKey of singletonKeys) await enqueue(new AskStillWanted({ entryId }), { singletonKey });
      await startWorkers();
      for (const singletonKey of singletonKeys) await expectJobCompleted(AskStillWanted[JOB_NAME], { singletonKey });
    }

    return { entry, notifications, run, runMany, findEntry: (id: string) => container.resolve(GpuWaitlistEntryRepository).findByIdAcrossOrganizations(id) };
  }
});
