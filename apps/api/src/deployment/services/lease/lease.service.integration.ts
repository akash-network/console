import "@src/app/providers/jobs.provider";

import { BidHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { type Job, JOB_NAME, JobQueueService } from "@src/core";
import { CreateLeaseHandler } from "@src/deployment/services/create-lease/create-lease.handler";
import { CreateLease, createLeaseKeyFor } from "@src/deployment/services/create-lease/create-lease.job";
import { ReconcileLeaseCreateHandler } from "@src/deployment/services/reconcile-lease-create/reconcile-lease-create.handler";
import { ReconcileLeaseCreate } from "@src/deployment/services/reconcile-lease-create/reconcile-lease-create.job";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { LeaseService } from "./lease.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows, runAsUser, useJobWorkers } from "@test/services/job-queue-harness";

const HELLO_WORLD_SDL = fs.readFileSync(path.resolve(__dirname, "../../../../test/mocks/hello-world-sdl.yml"), "utf8");

const jobWorkers = useJobWorkers(() => [container.resolve(CreateLeaseHandler), container.resolve(ReconcileLeaseCreateHandler)]);

describe(LeaseService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createLeasesInBackground", () => {
    it("commits the pending activity, the lease job and the later check on it together", async () => {
      const { createInBackground, user, singletonKey } = await setup();

      const queued = await createInBackground();

      expect(await container.resolve(ActivityRepository).findById(queued!.activityId)).toMatchObject({
        userId: user.id,
        type: "lease_create",
        status: "pending"
      });
      expect(await findJobRows(CreateLease[JOB_NAME], { singletonKey })).toEqual([
        expect.objectContaining({ state: "created", data: expect.objectContaining({ activityId: queued!.activityId }) })
      ]);
      expect(await findJobRows(ReconcileLeaseCreate[JOB_NAME], { data: { activityId: queued!.activityId } })).toHaveLength(1);
    });

    it("commits neither the activity nor the lease job when the later check cannot be queued", async () => {
      const { createInBackground, user, singletonKey } = await setup();
      const jobQueueService = container.resolve(JobQueueService);
      const enqueue = jobQueueService.enqueue.bind(jobQueueService);
      vi.spyOn(jobQueueService, "enqueue").mockImplementation(async (job: Job, options) => {
        if (job instanceof ReconcileLeaseCreate) throw new Error("connection reset");
        return await enqueue(job, options);
      });

      await expect(createInBackground()).rejects.toThrow("connection reset");

      expect(await container.resolve(ActivityRepository).find({ userId: user.id })).toEqual([]);
      expect(await findJobRows(CreateLease[JOB_NAME], { singletonKey })).toEqual([]);
    });
  });

  async function setup() {
    await jobWorkers();
    const { user, wallet, address } = await seedUserWithWallet();
    const dseq = createDseq();
    await seedDeploymentSetting({ userId: user.id, dseq, sdl: HELLO_WORLD_SDL, manifestVersion: "AAAA" });
    const leases = [{ dseq, gseq: 1, oseq: 1, provider: createAkashAddress() }];

    vi.spyOn(container.resolve(LeaseHttpService), "list").mockResolvedValue({ leases: [], pagination: { next_key: null, total: "0" } });
    vi.spyOn(container.resolve(BidHttpService), "list").mockResolvedValue([]);
    vi.spyOn(container.resolve(ProviderService), "assertReachable").mockResolvedValue(undefined);
    vi.spyOn(container.resolve(ManagedSignerService), "assertCanBroadcast").mockResolvedValue(undefined);

    return {
      user,
      singletonKey: createLeaseKeyFor({ owner: address, dseq }),
      createInBackground: async () =>
        await runAsUser(user, async () => await container.resolve(LeaseService).createLeasesInBackground({ leases, userId: wallet.userId }))
    };
  }
});
