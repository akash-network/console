import { AuthzHttpService, type DepositDeploymentGrant } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BalanceSnapshotRepository } from "@src/billing/repositories/balance-snapshot/balance-snapshot.repository";
import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { TakeBalanceSnapshotHandler } from "./take-balance-snapshot.handler";
import { TakeBalanceSnapshot } from "./take-balance-snapshot.job";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { deleteCompletedJobs, deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const TAKE = TakeBalanceSnapshot[JOB_NAME];
const TAKEN_ON = "2099-06-01";
const DAY_AFTER = "2099-06-02";

const jobWorkers = useJobWorkers(() => [container.resolve(TakeBalanceSnapshotHandler)]);

describe(TakeBalanceSnapshotHandler.name, () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteQueuedJobs(TAKE);
    await deleteCompletedJobs(TAKE);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    await db.delete(resolveTable("BalanceSnapshots"));
    await db.delete(resolveTable("FundingWallets"));
  });

  it("stores every grant the chain shows of the active and the draining funding wallet under the day asked for, run the way a worker runs it", async () => {
    const { chain, active, draining, runTake, findSnapshot } = await setup();
    const [first, second, notMovedYet] = [1, 2, 3].map(() => createAkashAddress());
    chain.grant(active.address, first, 1_500_000);
    chain.grant(active.address, second, 0);
    chain.grant(draining.address, notMovedYet, 700_000);

    await runTake(TAKEN_ON);

    const { snapshot, grants } = await findSnapshot(TAKEN_ON);
    expect(snapshot).toMatchObject({ status: "complete", height: chain.height, grantsCount: 3, failure: null });
    expect(grants).toHaveLength(3);
    expect(grants).toEqual(
      expect.arrayContaining([
        { granter: active.address, grantee: first, denom: "uact", amount: 1_500_000 },
        { granter: active.address, grantee: second, denom: "uact", amount: 0 },
        { granter: draining.address, grantee: notMovedYet, denom: "uact", amount: 700_000 }
      ])
    );
    expect(chain.heightsAsked()).toEqual([chain.height]);
  });

  it("keeps a complete day as it was read when it is asked for again", async () => {
    const { chain, active, handle, findSnapshot } = await setup();
    const grantee = createAkashAddress();
    chain.grant(active.address, grantee, 1_500_000);
    await handle(TAKEN_ON);
    const firstHeight = chain.height;
    chain.height += 500;
    chain.grant(active.address, grantee, 9);

    await handle(TAKEN_ON);

    const { snapshot, grants } = await findSnapshot(TAKEN_ON);
    expect(snapshot).toMatchObject({ status: "complete", height: firstHeight, grantsCount: 1 });
    expect(grants).toEqual([{ granter: active.address, grantee, denom: "uact", amount: 1_500_000 }]);
  });

  it("marks the day failed when the chain cannot be read partway, and reads it over from the start on the next try", async () => {
    const { chain, active, handle, findSnapshot } = await setup();
    const [stored, late] = [1, 2].map(() => createAkashAddress());
    chain.grant(active.address, stored, 100);
    chain.failNextReadOf(active.address, new Error("node has not reached this height"));

    await expect(handle(TAKEN_ON)).rejects.toThrow("node has not reached this height");

    await expect(findSnapshot(TAKEN_ON)).resolves.toMatchObject({
      snapshot: { status: "failed", failure: "node has not reached this height", grantsCount: null },
      grants: []
    });

    chain.height += 40;
    chain.grant(active.address, late, 250);
    await handle(TAKEN_ON);

    const { snapshot, grants } = await findSnapshot(TAKEN_ON);
    expect(snapshot).toMatchObject({ status: "complete", height: chain.height, grantsCount: 2, failure: null });
    expect(grants).toHaveLength(2);
    expect(grants).toEqual(
      expect.arrayContaining([
        { granter: active.address, grantee: stored, denom: "uact", amount: 100 },
        { granter: active.address, grantee: late, denom: "uact", amount: 250 }
      ])
    );
  });

  it("queues the next day's run a quarter past midnight UTC when it runs, once however often it is seeded", async () => {
    const { network, handler, runTake, findQueuedRuns } = await setup();

    await runTake(TAKEN_ON);
    await handler.seedNextRun(new Date(`${TAKEN_ON}T00:15:03.000Z`));
    await handler.seedNextRun(new Date(`${TAKEN_ON}T17:40:00.000Z`));

    await expect(findQueuedRuns()).resolves.toEqual([
      { takenOn: DAY_AFTER, singletonKey: `takeBalanceSnapshot.${network}.${DAY_AFTER}`, startsAt: `${DAY_AFTER}T00:15:00.000Z`, expiresAfterSeconds: 3600 }
    ]);
  });

  it("queues the day after the one it ran for when it runs days late, due at once, so no day is left without a run", async () => {
    const { network, handle, findQueuedRuns, findSnapshot } = await setup();

    await handle("2026-11-20");

    await expect(findQueuedRuns()).resolves.toEqual([
      { takenOn: "2026-11-21", singletonKey: `takeBalanceSnapshot.${network}.2026-11-21`, startsAt: "2026-11-21T00:15:00.000Z", expiresAfterSeconds: 3600 }
    ]);
    await expect(findSnapshot("2026-11-20")).resolves.toMatchObject({ snapshot: { status: "complete" } });
  });

  it("seeds a run that may stay active for an hour before it is retried", async () => {
    const { handler, findQueuedRuns } = await setup();

    await handler.seedNextRun(new Date(`${TAKEN_ON}T17:40:00.000Z`));

    await expect(findQueuedRuns()).resolves.toEqual([expect.objectContaining({ takenOn: DAY_AFTER, expiresAfterSeconds: 3600 })]);
  });

  async function setup() {
    const network = container.resolve(CoreConfigService).get("NETWORK");
    const fundingWallets = container.resolve(FundingWalletRepository);
    const active = await fundingWallets.create({ network, address: createAkashAddress(), status: "active" });
    const draining = await fundingWallets.create({ network, address: createAkashAddress(), status: "draining" });
    const grantsByGranter = new Map<string, Map<string, number>>();
    const failures = new Map<string, Error>();
    const heightsAsked = new Set<number | undefined>();
    const chain = {
      height: faker.number.int({ min: 20_000_000, max: 30_000_000 }),
      grant: (granter: string, grantee: string, amount: number) => {
        grantsByGranter.set(granter, (grantsByGranter.get(granter) ?? new Map()).set(grantee, amount));
      },
      failNextReadOf: (granter: string, error: Error) => failures.set(granter, error),
      heightsAsked: () => [...heightsAsked]
    };

    vi.spyOn(container.resolve(BlockHttpService), "getFreshCurrentHeight").mockImplementation(async () => chain.height);
    vi.spyOn(container.resolve(FundingWalletRegistryService), "getActiveAddress").mockResolvedValue(active.address);
    vi.spyOn(container.resolve(AuthzHttpService), "getPaginatedDepositDeploymentGrants").mockImplementation(async options => {
      const granter = (options as { granter: string }).granter;
      const failure = failures.get(granter);
      heightsAsked.add(options.height);

      if (failure) {
        failures.delete(granter);
        throw failure;
      }

      const grants = [...(grantsByGranter.get(granter) ?? [])].map(
        ([grantee, amount]): DepositDeploymentGrant => ({
          granter,
          grantee,
          authorization: { "@type": "/akash.escrow.v1.DepositAuthorization", spend_limits: [{ denom: "uact", amount: String(amount) }] },
          expiration: ""
        })
      );

      return { grants: grants.slice(options.offset, options.offset + options.limit), pagination: { next_key: null, total: grants.length } };
    });

    const { enqueue, startWorkers } = await jobWorkers();
    const handler = container.resolve(TakeBalanceSnapshotHandler);

    const runTake = async (takenOn: string) => {
      await enqueue(new TakeBalanceSnapshot({ takenOn }));
      await startWorkers();
      await expectJobCompleted(TAKE, { data: { takenOn } });
    };

    const findQueuedRuns = async () => {
      const queued = await findJobRows<{ takenOn: string }>(TAKE, { state: "created" });

      return queued.map(job => ({
        takenOn: job.data.takenOn,
        singletonKey: job.singleton_key,
        startsAt: new Date(job.start_after).toISOString(),
        expiresAfterSeconds: job.expire_seconds
      }));
    };

    const findSnapshot = async (takenOn: string) => {
      const repository = container.resolve(BalanceSnapshotRepository);
      const snapshot = await repository.findByDay({ network, takenOn });

      return { snapshot, grants: snapshot ? await repository.findGrants(snapshot.id) : [] };
    };

    return {
      network,
      chain,
      active,
      draining,
      handler,
      handle: (takenOn: string) => handler.handle({ takenOn, version: 1 }),
      runTake,
      findQueuedRuns,
      findSnapshot
    };
  }
});
