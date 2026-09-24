import { type Bid, BidHttpService, LeaseHttpService, type RpcLease } from "@akashnetwork/http-sdk";
import { and, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { RecordLeaseGpuOffers, recordLeaseGpuOffersKeyFor } from "@src/deployment/services/lease-gpu-offer-job/lease-gpu-offer-job.service";
import { RecordLeaseGpuOffersHandler } from "./record-lease-gpu-offers.handler";

import { createBid } from "@test/seeders/bid.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const PROVIDER = "akash1provider";
const A100_SXM = { key: "vendor/nvidia/model/a100/ram/80Gi/interface/sxm", value: "true" };

const jobWorkers = useJobWorkers(() => [container.resolve(RecordLeaseGpuOffersHandler)]);

describe(RecordLeaseGpuOffersHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records the gpus the lease's bid offered on the deployment's settings, run the way a worker runs it", async () => {
    const { singletonKey, run, findOffers } = await setup({});

    await run();

    await expectJobCompleted(RecordLeaseGpuOffers[JOB_NAME], { singletonKey });
    await expect(findOffers()).resolves.toEqual([
      {
        gseq: 1,
        oseq: 1,
        provider: PROVIDER,
        bseq: 0,
        resources: [{ resourceId: 1, replicas: 1, unitsPerReplica: 8, attributes: [A100_SXM] }],
        recordedAt: expect.any(String)
      }
    ]);
  });

  it("keeps one offer per lease when it runs again", async () => {
    const { singletonKey, run, findOffers, handler, payload } = await setup({});

    await run();
    await expectJobCompleted(RecordLeaseGpuOffers[JOB_NAME], { singletonKey });
    await handler.handle(payload);

    await expect(findOffers()).resolves.toHaveLength(1);
  });

  it("records nothing for a deployment whose bid offered no gpu", async () => {
    const { singletonKey, run, findOffers } = await setup({ gpuUnits: "0" });

    await run();

    await expectJobCompleted(RecordLeaseGpuOffers[JOB_NAME], { singletonKey });
    await expect(findOffers()).resolves.toBeNull();
  });

  it("retries while the chain shows no live lease yet", async () => {
    const { singletonKey, run } = await setup({ noLiveLease: true });

    await run();

    await awaitRetrying(singletonKey);
  });

  it("retries while the deployment has no settings row to hold the offer", async () => {
    const { singletonKey, run } = await setup({ withoutSetting: true });

    await run();

    await awaitRetrying(singletonKey);
  });

  it("declares no permissions, because a worker carries no user", () => {
    expect(container.resolve(RecordLeaseGpuOffersHandler).requiresPermission()).toEqual([]);
  });

  async function awaitRetrying(singletonKey: string) {
    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(RecordLeaseGpuOffers[JOB_NAME], { singletonKey });
        expect(row?.state).toBe("retry");
      },
      { timeout: 20_000, interval: 250 }
    );
  }

  async function setup(input: { gpuUnits?: string; noLiveLease?: boolean; withoutSetting?: boolean }) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const { user, wallet, address } = await seedUserWithWallet();
    const dseq = createDseq();
    if (!input.withoutSetting) await seedDeploymentSetting({ userId: user.id, dseq, sdl: null });

    const bid: Bid = createBid({ owner: address, dseq, gseq: 1, oseq: 1, provider: PROVIDER, bseq: 0 });
    bid.bid.resources_offer[0].resources.gpu = { units: { val: input.gpuUnits ?? "8" }, attributes: input.gpuUnits === "0" ? [] : [A100_SXM] };
    const lease = createLeaseApiResponse({ state: "active" }) as RpcLease;
    lease.lease.id = { ...bid.bid.id };

    vi.spyOn(container.resolve(BidHttpService), "list").mockResolvedValue([bid]);
    vi.spyOn(container.resolve(LeaseHttpService), "list").mockImplementation(
      async ({ state }) =>
        ({ leases: state === "active" && !input.noLiveLease ? [lease] : [], pagination: { next_key: null, total: "0" } }) as Awaited<
          ReturnType<LeaseHttpService["list"]>
        >
    );

    const payload = { walletId: wallet.id, dseq, version: 1 as const };
    const singletonKey = recordLeaseGpuOffersKeyFor({ walletId: wallet.id, dseq });
    const { enqueue, startWorkers } = await jobWorkers();

    return {
      handler: container.resolve(RecordLeaseGpuOffersHandler),
      payload,
      singletonKey,
      run: async () => {
        await enqueue(new RecordLeaseGpuOffers({ walletId: wallet.id, dseq }), { singletonKey });
        await startWorkers();
      },
      findOffers: async () => {
        const [setting] = await db
          .select({ offeredGpus: deploymentSettingsTable.offeredGpus })
          .from(deploymentSettingsTable)
          .where(and(eq(deploymentSettingsTable.userId, user.id), eq(deploymentSettingsTable.dseq, dseq)));

        return setting.offeredGpus;
      }
    };
  }
});
