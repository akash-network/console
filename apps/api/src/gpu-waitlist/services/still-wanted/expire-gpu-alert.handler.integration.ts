import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { GpuWaitlistNetworkService } from "@src/gpu-waitlist/services/gpu-waitlist-network/gpu-waitlist-network.service";
import { ExpireGpuAlertHandler } from "./expire-gpu-alert.handler";
import { ExpireGpuAlert } from "./expire-gpu-alert.job";

import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

vi.hoisted(() => {
  process.env.GPU_WAITLIST_NETWORKS = "mainnet,testnet,sandbox";
});

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const jobWorkers = useJobWorkers(() => [container.resolve(ExpireGpuAlertHandler)]);

describe(ExpireGpuAlertHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("expires an entry nobody kept, run the way a worker runs it", async () => {
    const { entry, run, findEntry } = await setup({ status: "waiting", askedMsAgo: 7 * DAY_MS + MINUTE_MS });

    await run(entry.id);

    expect(await findEntry(entry.id)).toMatchObject({ status: "expired", endedAt: expect.any(Date) });
  });

  it("keeps an entry confirmed in time", async () => {
    const { entry, run, findEntry } = await setup({ status: "waiting", askedMsAgo: null });

    await run(entry.id);

    expect(await findEntry(entry.id)).toMatchObject({ status: "waiting", endedAt: null });
  });

  it("expires an entry asked just over the grace period ago and keeps one asked just under it", async () => {
    const over = await setup({ status: "waiting", askedMsAgo: 7 * DAY_MS + MINUTE_MS });
    const under = await setup({ status: "waiting", askedMsAgo: 7 * DAY_MS - MINUTE_MS });

    await over.run(over.entry.id);
    await under.run(under.entry.id);

    expect((await over.findEntry(over.entry.id))?.status).toBe("expired");
    expect((await under.findEntry(under.entry.id))?.status).toBe("waiting");
  });

  it("queues another expiry for the time left when it runs before the grace period is over", async () => {
    const { entry, run, findEntry } = await setup({ status: "waiting", askedMsAgo: 2 * DAY_MS });

    await run(entry.id);

    expect((await findEntry(entry.id))?.status).toBe("waiting");
    const [next] = (await findJobRows<{ entryId: string }>(ExpireGpuAlert[JOB_NAME], { state: "created" })).filter(row => row.data.entryId === entry.id);
    const remainingMs = new Date(next.start_after).getTime() - Date.now();
    expect(remainingMs).toBeGreaterThan(4.9 * DAY_MS);
    expect(remainingMs).toBeLessThanOrEqual(5 * DAY_MS);
  });

  it("expires nothing and checks again a day later while the flag is off", async () => {
    const { entry, run, findEntry } = await setup({ status: "waiting", askedMsAgo: 8 * DAY_MS, flagOn: false });

    await run(entry.id);

    expect((await findEntry(entry.id))?.status).toBe("waiting");
    const [next] = (await findJobRows<{ entryId: string }>(ExpireGpuAlert[JOB_NAME], { state: "created" })).filter(row => row.data.entryId === entry.id);
    expect(new Date(next.start_after).getTime() - Date.now()).toBeGreaterThan(23 * 60 * MINUTE_MS);
  });

  it("expires nothing and queues nothing on a network that does not serve gpu waitlists", async () => {
    const { entry, run, findEntry } = await setup({ status: "waiting", askedMsAgo: 8 * DAY_MS });
    vi.spyOn(container.resolve(GpuWaitlistNetworkService), "servesGpuWaitlists").mockReturnValue(false);

    await run(entry.id);

    expect((await findEntry(entry.id))?.status).toBe("waiting");
    const rows = await findJobRows<{ entryId: string }>(ExpireGpuAlert[JOB_NAME], { state: "created" });
    expect(rows.filter(row => row.data.entryId === entry.id)).toEqual([]);
  });

  it("queues nothing while the flag is off for an entry that already ended", async () => {
    const { entry, run } = await setup({ status: "fulfilled", askedMsAgo: 8 * DAY_MS, flagOn: false });

    await run(entry.id);

    const rows = await findJobRows<{ entryId: string }>(ExpireGpuAlert[JOB_NAME], { state: "created" });
    expect(rows.filter(row => row.data.entryId === entry.id)).toEqual([]);
  });

  it("queues nothing more for an entry whose question was cleared", async () => {
    const { entry, run } = await setup({ status: "waiting", askedMsAgo: null });

    await run(entry.id);

    const rows = await findJobRows<{ entryId: string }>(ExpireGpuAlert[JOB_NAME], { state: "created" });
    expect(rows.filter(row => row.data.entryId === entry.id)).toEqual([]);
  });

  it("leaves an entry that already ended as it was", async () => {
    const { entry, run, findEntry } = await setup({ status: "fulfilled", askedMsAgo: 7 * DAY_MS + MINUTE_MS });

    await run(entry.id);

    expect((await findEntry(entry.id))?.status).toBe("fulfilled");
  });

  async function setup(input: { status: "waiting" | "fulfilled"; askedMsAgo: number | null; flagOn?: boolean }) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(
      flag => (input.flagOn ?? true) || flag !== FeatureFlags.GPU_AVAILABILITY_ALERTS
    );
    const user = await seedUser();
    const entry = await seedGpuWaitlistEntry({
      userId: user.id,
      status: input.status,
      stillWantedAskedAt: input.askedMsAgo === null ? null : new Date(Date.now() - input.askedMsAgo)
    });

    async function run(entryId: string) {
      const { enqueue, startWorkers } = await jobWorkers();
      const singletonKey = faker.string.uuid();
      await enqueue(new ExpireGpuAlert({ entryId }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(ExpireGpuAlert[JOB_NAME], { singletonKey });
    }

    return { entry, run, findEntry: (id: string) => container.resolve(GpuWaitlistEntryRepository).findByIdAcrossOrganizations(id) };
  }
});
