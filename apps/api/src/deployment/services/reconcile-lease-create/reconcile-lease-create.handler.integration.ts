import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { addMinutes } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActivityStatus } from "@src/activity/model-schemas";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { JOB_NAME } from "@src/core";
import { CreateLeaseHandler } from "@src/deployment/services/create-lease/create-lease.handler";
import { CreateLease, createLeaseKeyFor } from "@src/deployment/services/create-lease/create-lease.job";
import { LeaseService } from "@src/deployment/services/lease/lease.service";
import { pendingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { ReconcileLeaseCreateHandler } from "./reconcile-lease-create.handler";
import { ReconcileLeaseCreate, reconcileLeaseCreateKeyFor, reconcileLeaseCreateOptionsFor } from "./reconcile-lease-create.job";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ReconcileLeaseCreateHandler), container.resolve(CreateLeaseHandler)]);

describe(ReconcileLeaseCreateHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records leases whose job is gone as not created when none landed, run the way a worker runs it", async () => {
    const { reconcile, findActivity, activityId } = await setup({ leasesExist: false });

    await reconcile({ createLeaseJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileLeaseCreate[JOB_NAME], { data: { activityId } });
    expect(await findActivity()).toMatchObject({ status: "failed", meta: { error: { code: "lease_not_created" } } });
  });

  it("runs the lease job again for leases that landed after their job was lost, which settles the activity, and checks on it later", async () => {
    const { reconcile, findActivity, activityId, singletonKey } = await setup({ leasesExist: true });
    const finish = vi.spyOn(container.resolve(LeaseService), "createQueuedLeases").mockResolvedValue(undefined);

    await reconcile({ createLeaseJobId: faker.string.uuid() });

    await expectJobCompleted(CreateLease[JOB_NAME], { singletonKey });
    expect(finish).toHaveBeenCalledWith({ userId: expect.any(String), leases: [expect.objectContaining({ gseq: 1, oseq: 1 })] });
    expect(await findJobRows(ReconcileLeaseCreate[JOB_NAME], { data: { activityId }, state: "created" })).toHaveLength(1);
    expect(await findActivity()).toMatchObject({ status: "succeeded" });
  });

  it("leaves the activity pending and checks again later while the lease job is still queued", async () => {
    const { reconcile, queueCreateLeaseJob, findActivity, activityId, leasesExist } = await setup({ leasesExist: false });
    const createLeaseJobId = await queueCreateLeaseJob();

    await reconcile({ createLeaseJobId });

    await expectJobCompleted(ReconcileLeaseCreate[JOB_NAME], { data: { activityId }, state: "completed" });
    const [nextCheck] = await findJobRows(ReconcileLeaseCreate[JOB_NAME], { data: { activityId }, state: "created" });
    expect(new Date(nextCheck.start_after).getTime()).toBeGreaterThan(addMinutes(new Date(), 4).getTime());
    expect(nextCheck.data).toMatchObject({ activityId, createLeaseJobId });
    expect(leasesExist).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "pending" });
  });

  it("keeps one waiting check per activity when a second one is queued for it", async () => {
    const { queueCheck, activityId } = await setup({ leasesExist: false });

    await queueCheck();
    await queueCheck();

    expect(await findJobRows(ReconcileLeaseCreate[JOB_NAME], { data: { activityId } })).toHaveLength(1);
  });

  it("leaves an activity its lease job already settled as it is", async () => {
    const { reconcile, findActivity, activityId, leasesExist } = await setup({ leasesExist: false, status: "succeeded" });

    await reconcile({ createLeaseJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileLeaseCreate[JOB_NAME], { data: { activityId } });
    expect(leasesExist).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "succeeded" });
  });

  async function setup(input: { leasesExist: boolean; status?: ActivityStatus }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const { wallet, address: owner } = await seedUserWithWallet();
    const leases = [{ dseq: createDseq(), gseq: 1, oseq: 1, provider: createAkashAddress() }];
    const activity = await activityRepository.create({ ...pendingLeaseActivityOf({ userId: wallet.userId, leases }), status: input.status ?? "pending" });
    const leasesExist = vi.spyOn(container.resolve(LeaseService), "leasesExist").mockResolvedValue(input.leasesExist);
    const singletonKey = createLeaseKeyFor({ owner, dseq: leases[0].dseq });

    return {
      activityId: activity.id,
      singletonKey,
      leasesExist,
      queueCreateLeaseJob: async () =>
        (await enqueue(new CreateLease({ userId: wallet.userId, leases, activityId: activity.id }), {
          singletonKey,
          startAfter: addMinutes(new Date(), 60).toISOString()
        })) as string,
      queueCheck: async () =>
        await enqueue(
          new ReconcileLeaseCreate({ userId: wallet.userId, owner, leases, activityId: activity.id, createLeaseJobId: faker.string.uuid() }),
          reconcileLeaseCreateOptionsFor(activity.id, new Date())
        ),
      reconcile: async ({ createLeaseJobId }: { createLeaseJobId: string }) => {
        await enqueue(new ReconcileLeaseCreate({ userId: wallet.userId, owner, leases, activityId: activity.id, createLeaseJobId }), {
          singletonKey: reconcileLeaseCreateKeyFor(activity.id)
        });
        await startWorkers();
      },
      findActivity: async () => await activityRepository.findById(activity.id)
    };
  }
});
