import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { GpuSetupCheckService } from "@src/deployment/services/gpu-setup-check/gpu-setup-check.service";
import { GpuWaitlistPoolRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-pool/gpu-waitlist-pool.repository";
import { ConfirmGpuPoolsHandler } from "@src/gpu-waitlist/services/confirm-gpu-pools/confirm-gpu-pools.handler";
import { ConfirmGpuPools } from "@src/gpu-waitlist/services/confirm-gpu-pools/confirm-gpu-pools.job";
import { WATCH_GPU_WAITLISTS_KEY, WatchGpuWaitlistsHandler } from "./watch-gpu-waitlists.handler";
import { WatchGpuWaitlists } from "./watch-gpu-waitlists.job";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(WatchGpuWaitlistsHandler), container.resolve(ConfirmGpuPoolsHandler)]);

describe(WatchGpuWaitlistsHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  it("hands a pool whose free gpus rose to a confirmation and queues its next watch, run the way a worker runs it", async () => {
    const { entry, check, run } = await setup();

    await run();

    const [pool] = await container.resolve(GpuWaitlistPoolRepository).findByPoolKeys([entry.poolKey]);
    expect(pool).toEqual(expect.objectContaining({ lastFreeUnits: 8, lastMaxNodeFreeUnits: 8, lastCheckAt: expect.any(Date) }));
    expect(check).toHaveBeenCalledWith([{ vendor: "nvidia", model: "h100", memory: "80Gi", interface: "sxm", count: 2 }]);
    expect(await findJobRows(WatchGpuWaitlists[JOB_NAME], { singletonKey: WATCH_GPU_WAITLISTS_KEY, state: "created" })).toHaveLength(1);
  });

  it("keeps a single queued watch when a replica seeds while the next run is scheduled", async () => {
    const { enqueue } = await jobWorkers();
    await deleteQueuedJobs(WatchGpuWaitlists[JOB_NAME]);
    const scheduledAt = new Date(Date.now() + 5 * 60 * 1000);
    await enqueue(new WatchGpuWaitlists(), { singletonKey: WATCH_GPU_WAITLISTS_KEY, startAfter: scheduledAt.toISOString() });

    await container.resolve(WatchGpuWaitlistsHandler).seedNextRun();

    const queued = await findJobRows(WatchGpuWaitlists[JOB_NAME], { singletonKey: WATCH_GPU_WAITLISTS_KEY, state: "created" });
    expect(queued).toHaveLength(1);
  });

  async function setup() {
    const { user } = await seedUserWithWallet({ isTrialing: false });
    const entry = await seedGpuWaitlistEntry({ userId: user.id, model: "h100", memory: "80Gi", interface: "SXM5", gpuCount: 2 });
    const provider = createAkashAddress();
    await container
      .resolve(GpuBidCheckRepository)
      .insertMany([{ provider, vendor: "nvidia", model: "h100", source: "setup-check", dseq: "1", screened: true, bid: true, checkedAt: new Date() }]);
    nock(container.resolve(DeploymentConfigService).get("PROVIDER_INVENTORY_API_URL"))
      .persist()
      .get("/v1/gpu-supply")
      .query({ vendor: "nvidia", model: "h100" })
      .reply(200, { data: [{ owner: provider, node: 0, vendor: "nvidia", model: "h100", memory: "80Gi", interface: "sxm5", units: 8, nodeFreeUnits: 8 }] });
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(true);
    const check = vi.spyOn(container.resolve(GpuSetupCheckService), "check").mockResolvedValue({ status: "cap_reached" });

    async function run() {
      const { enqueue, startWorkers } = await jobWorkers();
      await enqueue(new WatchGpuWaitlists(), { singletonKey: WATCH_GPU_WAITLISTS_KEY });
      await startWorkers();
      await expectJobCompleted(WatchGpuWaitlists[JOB_NAME], { state: "completed" });
      await expectJobCompleted(ConfirmGpuPools[JOB_NAME]);
    }

    return { entry, check, run };
  }
});
