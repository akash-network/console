import "@src/app/providers/jobs.provider";

import type { Bid } from "@akashnetwork/http-sdk";
import { addSeconds, subMinutes } from "date-fns";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { BidService } from "@src/bid/services/bid/bid.service";
import { JOB_NAME } from "@src/core";
import type { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLeaseHandler } from "@src/deployment/services/create-lease/create-lease.handler";
import { CreateLease, createLeaseKeyFor } from "@src/deployment/services/create-lease/create-lease.job";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { LeaseService } from "@src/deployment/services/lease/lease.service";
import { ReconcileLeaseCreateHandler } from "@src/deployment/services/reconcile-lease-create/reconcile-lease-create.handler";
import { createdLeaseActivityOf, matchingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { ProviderProxyService } from "@src/provider/services/provider/provider-proxy.service";
import { AutoLeaseHandler } from "./auto-lease.handler";
import { AutoLease, autoLeaseKeyFor } from "./auto-lease.job";
import { AutoLeaseService } from "./auto-lease.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBid } from "@test/seeders/bid.seeder";
import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, runAsUser, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [
  container.resolve(AutoLeaseHandler),
  container.resolve(CreateLeaseHandler),
  container.resolve(ReconcileLeaseCreateHandler)
]);

describe(AutoLeaseHandler.name, () => {
  it("leases the first bidder that answered under the match's activity, run the way a worker runs it", async () => {
    const provider = createAkashAddress();
    const { startMatch, startWorkers, findActivity, owner, dseq, userId } = await setup({ bidders: [provider], reachable: [provider] });
    const createQueuedLeases = vi.spyOn(container.resolve(LeaseService), "createQueuedLeases").mockResolvedValue(undefined);

    const activityId = await startMatch();
    await startWorkers();

    await expectJobCompleted(AutoLease[JOB_NAME], { singletonKey: autoLeaseKeyFor({ owner, dseq }) });
    await expectJobCompleted(CreateLease[JOB_NAME], { singletonKey: createLeaseKeyFor({ owner, dseq }) });
    const leases = [{ dseq, gseq: 1, oseq: 1, provider }];
    expect(createQueuedLeases).toHaveBeenCalledWith(expect.objectContaining({ wallet: expect.objectContaining({ address: owner }), userId }), leases);
    expect(await findActivity(activityId)).toMatchObject({ status: "succeeded", meta: createdLeaseActivityOf({ userId, leases }).meta });
  });

  it("queues its next tick behind the running one while no provider has bid", async () => {
    const { startMatch, startWorkers, findActivity, owner, dseq, userId } = await setup({ bidders: [], reachable: [] });

    const activityId = await startMatch();
    await startWorkers();

    const singletonKey = autoLeaseKeyFor({ owner, dseq });
    await expectJobCompleted(AutoLease[JOB_NAME], { singletonKey, state: "completed" });
    const [nextTick] = await findJobRows(AutoLease[JOB_NAME], { singletonKey, state: "created" });
    expect(new Date(nextTick.start_after).getTime()).toBeGreaterThan(addSeconds(new Date(), 2).getTime());
    expect(await findActivity(activityId)).toMatchObject({ status: "pending", meta: matchingLeaseActivityOf({ userId, dseq }).meta });
  });

  it("closes a deployment no provider bid on in time and records the match as failed", async () => {
    const { enqueueTick, startWorkers, findActivity, close, openActivity, owner, dseq } = await setup({ bidders: [], reachable: [] });
    const activityId = await openActivity();

    await enqueueTick({ activityId, startedAt: subMinutes(new Date(), 6) });
    await startWorkers();

    await expectJobCompleted(AutoLease[JOB_NAME], { singletonKey: autoLeaseKeyFor({ owner, dseq }) });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ address: owner }), dseq, expect.objectContaining({ actingUserId: expect.any(String) }));
    expect(await findActivity(activityId)).toMatchObject({ status: "failed", meta: { dseq, providers: [], error: { code: "no_provider_bids" } } });
  });

  async function setup(input: { bidders: string[]; reachable: string[] }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const { user, wallet, address: owner } = await seedUserWithWallet();
    const dseq = createDseq();
    const activityRepository = container.resolve(ActivityRepository);

    stubChainFor({ owner, dseq, bids: input.bidders.map(provider => createBid({ owner, provider, dseq, gseq: 1, oseq: 1 })) });
    stubProvidersAnswering(new Set(input.reachable));
    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockImplementation(async (closingWallet, closingDseq) => {
      if (closingWallet.address !== owner || closingDseq !== dseq) throw new Error("closed another test's deployment");
      return true;
    });

    return {
      owner,
      dseq,
      userId: user.id,
      close,
      startWorkers,
      startMatch: async () => {
        await runAsUser(user, () => container.resolve(AutoLeaseService).start({ userId: user.id, walletId: wallet.id, dseq }));
        const [tick] = await findJobRows<{ activityId: string }>(AutoLease[JOB_NAME], { singletonKey: autoLeaseKeyFor({ owner, dseq }) });
        return tick.data.activityId;
      },
      openActivity: async () => (await activityRepository.create(matchingLeaseActivityOf({ userId: user.id, dseq }))).id,
      enqueueTick: async ({ activityId, startedAt }: { activityId: string; startedAt: Date }) =>
        await enqueue(new AutoLease({ userId: user.id, walletId: wallet.id, owner, dseq, activityId, startedAt: startedAt.toISOString() }), {
          singletonKey: autoLeaseKeyFor({ owner, dseq })
        }),
      findActivity: async (activityId: string) => await activityRepository.findById(activityId)
    };
  }

  function stubChainFor({ owner, dseq, bids }: { owner: string; dseq: string; bids: Bid[] }) {
    vi.spyOn(container.resolve(DeploymentReaderService), "findWithGroupSpecsByWalletAndDseq").mockImplementation(async (readWallet, readDseq) => {
      const isThisTestsDeployment = readWallet.address === owner && readDseq === dseq;
      return {
        deployment: mock<DeploymentResponse>({ deployment: { state: isThisTestsDeployment ? "active" : "closed" }, leases: [] }),
        groupSpecs: [mock()]
      };
    });
    vi.spyOn(container.resolve(BidService), "listForWallet").mockImplementation(async (bidWallet, bidDseq) =>
      bidWallet.address === owner && bidDseq === dseq ? bids : []
    );
  }

  function stubProvidersAnswering(reachable: Set<string>) {
    vi.spyOn(container.resolve(ProviderRepository), "getProvidersByAddressesWithAttributes").mockImplementation(
      async owners => owners.map(owner => ({ owner, hostUri: `https://${owner}.example.com` })) as never
    );
    vi.spyOn(container.resolve(ProviderProxyService), "request").mockImplementation(async (_url, { providerIdentity }) => {
      if (!reachable.has(providerIdentity.owner)) throw new Error("provider unreachable");
      return {};
    });
  }
});
