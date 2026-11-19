import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { JOB_NAME } from "@src/core";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { ExpireGpuAlertHandler } from "./expire-gpu-alert.handler";
import { ExpireGpuAlert } from "./expire-gpu-alert.job";

import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const DAY_MS = 24 * 60 * 60 * 1000;

const jobWorkers = useJobWorkers(() => [container.resolve(ExpireGpuAlertHandler)]);

describe(ExpireGpuAlertHandler.name, () => {
  it("expires an entry nobody kept, run the way a worker runs it", async () => {
    const { entry, run, findEntry } = await setup({ status: "waiting", askedDaysAgo: 7 });

    await run(entry.id);

    expect(await findEntry(entry.id)).toMatchObject({ status: "expired", endedAt: expect.any(Date) });
  });

  it("keeps an entry confirmed in time", async () => {
    const { entry, run, findEntry } = await setup({ status: "waiting", askedDaysAgo: null });

    await run(entry.id);

    expect(await findEntry(entry.id)).toMatchObject({ status: "waiting", endedAt: null });
  });

  it("keeps an entry whose latest question is younger than the grace period", async () => {
    const { entry, run, findEntry } = await setup({ status: "waiting", askedDaysAgo: 2 });

    await run(entry.id);

    expect(await findEntry(entry.id)).toMatchObject({ status: "waiting", endedAt: null });
  });

  it("leaves an entry that already ended as it was", async () => {
    const { entry, run, findEntry } = await setup({ status: "fulfilled", askedDaysAgo: 7 });

    await run(entry.id);

    expect((await findEntry(entry.id))?.status).toBe("fulfilled");
  });

  async function setup(input: { status: "waiting" | "fulfilled"; askedDaysAgo: number | null }) {
    const user = await seedUser();
    const entry = await seedGpuWaitlistEntry({
      userId: user.id,
      status: input.status,
      stillWantedAskedAt: input.askedDaysAgo === null ? null : new Date(Date.now() - input.askedDaysAgo * DAY_MS)
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
