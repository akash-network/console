import { AuthzHttpService, type DepositDeploymentGrant, type FeeAllowance } from "@akashnetwork/http-sdk";
import { eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { FundingWalletMoveRepository, type FundingWalletMoveStatus } from "@src/billing/repositories/funding-wallet-move/funding-wallet-move.repository";
import { MoveUserToActiveFundingWalletHandler } from "@src/billing/services/funding-wallet-move/move-user-to-active-funding-wallet.handler";
import { MoveUserToActiveFundingWallet } from "@src/billing/services/funding-wallet-move/move-user-to-active-funding-wallet.job";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { FundingWalletDrainService } from "./funding-wallet-drain.service";

import { createAkashAddress, createDeployment } from "@test/seeders";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { deleteQueuedJobs, useJobWorkers } from "@test/services/job-queue-harness";

const MOVE = MoveUserToActiveFundingWallet[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(MoveUserToActiveFundingWalletHandler)]);

describe(FundingWalletDrainService.name, () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteQueuedJobs(MOVE);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    await db.delete(resolveTable("FundingWalletMoves"));
    await db.delete(resolveTable("UserWalletGranters"));
    await db.delete(resolveTable("FundingWallets"));
  });

  it("queues a move for every user wallet the chain shows a grant of, the ones with a running deployment first, to start once late grants have landed", async () => {
    const { service, network, findQueuedMoves, seedGrantee } = await setup();
    const withDeployment = await seedGrantee({ hasDepositGrant: true, hasFeeAllowance: true, hasOpenDeployment: true });
    const withClosedDeployment = await seedGrantee({ hasDepositGrant: true, hasClosedDeployment: true });
    const withFeesOnly = await seedGrantee({ hasFeeAllowance: true });
    await seedGrantee({ hasDepositGrant: true, isUserWallet: false });

    await expect(service.queueMoves()).resolves.toEqual({ queued: 3, alreadyQueued: 0, withOpenDeployments: 1, unknownGrantees: 1 });

    const queued = await findQueuedMoves();
    expect(queued).toEqual(
      expect.arrayContaining([
        { userWalletId: withDeployment.id, singletonKey: `${network}.${withDeployment.id}`, priority: 1, startsWithinMinutes: expect.any(Number) },
        { userWalletId: withClosedDeployment.id, singletonKey: `${network}.${withClosedDeployment.id}`, priority: 0, startsWithinMinutes: expect.any(Number) },
        { userWalletId: withFeesOnly.id, singletonKey: `${network}.${withFeesOnly.id}`, priority: 0, startsWithinMinutes: expect.any(Number) }
      ])
    );
    expect(queued).toHaveLength(3);
    expect(queued.every(({ startsWithinMinutes }) => startsWithinMinutes > 3 && startsWithinMinutes < 5)).toBe(true);
  });

  it("queues nothing twice when it runs again while the moves are still queued", async () => {
    const { service, findQueuedMoves, seedGrantee } = await setup();
    await seedGrantee({ hasDepositGrant: true });
    await seedGrantee({ hasFeeAllowance: true });
    await service.queueMoves();

    await expect(service.queueMoves()).resolves.toEqual({ queued: 0, alreadyQueued: 2, withOpenDeployments: 0, unknownGrantees: 0 });

    await expect(findQueuedMoves()).resolves.toHaveLength(2);
  });

  it("reports what is left on chain next to how the moves stand", async () => {
    const { service, draining, seedGrantee, seedMove } = await setup();
    await seedGrantee({ hasDepositGrant: true, hasFeeAllowance: true });
    await seedGrantee({ hasFeeAllowance: true });
    await seedMove("completed");
    await seedMove("completed");
    await seedMove("failed");

    await expect(service.describe()).resolves.toEqual({
      address: draining.address,
      depositGrantsLeft: 1,
      feeAllowancesLeft: 2,
      moves: { completed: 2, failed: 1 }
    });
  });

  it("keeps the wallet draining while the chain still shows a grant of it or a move off it is unfinished", async () => {
    const { service, draining, findStatus, seedGrantee, seedMove, chain } = await setup();
    const { address } = await seedGrantee({ hasFeeAllowance: true });

    await expect(service.retire(draining.address)).rejects.toMatchObject({ status: 409, feeAllowancesLeft: 1 });
    await expect(findStatus()).resolves.toBe("draining");

    chain.feeGrantees.delete(address);
    await seedMove("revoked");

    await expect(service.retire(draining.address)).rejects.toMatchObject({ status: 409, unfinishedMoves: 1 });
    await expect(findStatus()).resolves.toBe("draining");
  });

  it("retires the drained wallet, after which another standby can take over", async () => {
    const { service, draining, network, findStatus, seedMove } = await setup();
    await seedMove("completed");
    await seedMove("failed");

    await service.retire(draining.address);

    await expect(findStatus()).resolves.toBe("retired");
    await expect(container.resolve(FundingWalletRepository).findDraining(network)).resolves.toBeUndefined();
    await expect(service.describe()).rejects.toMatchObject({ status: 409 });
  });

  async function setup() {
    await jobWorkers();
    const network = container.resolve(CoreConfigService).get("NETWORK");
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const fundingWallets = container.resolve(FundingWalletRepository);
    const fundingWalletsTable = resolveTable("FundingWallets");
    const draining = await fundingWallets.create({ network, address: createAkashAddress(), status: "draining" });
    const active = await fundingWallets.create({ network, address: createAkashAddress(), status: "active" });
    const chain = { depositGrantees: new Set<string>(), feeGrantees: new Set<string>() };
    const authz = container.resolve(AuthzHttpService);
    const depositGrantOf = (grantee: string): DepositDeploymentGrant => ({
      granter: draining.address,
      grantee,
      authorization: { "@type": "/akash.escrow.v1.DepositAuthorization", spend_limits: [] },
      expiration: ""
    });
    const feeAllowanceOf = (grantee: string): FeeAllowance => ({
      granter: draining.address,
      grantee,
      allowance: { "@type": "/cosmos.feegrant.v1beta1.BasicAllowance", spend_limit: [], expiration: "" }
    });

    vi.spyOn(authz, "getAllDepositDeploymentGrants").mockImplementation(async () => [...chain.depositGrantees].map(depositGrantOf));
    vi.spyOn(authz, "getPaginatedDepositDeploymentGrants").mockImplementation(async ({ limit, offset }) => ({
      grants: [...chain.depositGrantees].slice(offset, offset + limit).map(depositGrantOf),
      pagination: { next_key: null, total: chain.depositGrantees.size }
    }));
    vi.spyOn(authz, "getPaginatedFeeAllowancesForGranter").mockImplementation(async (_granter, limit, offset) => ({
      allowances: [...chain.feeGrantees].slice(offset, offset + limit).map(feeAllowanceOf),
      pagination: { next_key: null, total: chain.feeGrantees.size }
    }));

    const seedGrantee = async (input: {
      hasDepositGrant?: boolean;
      hasFeeAllowance?: boolean;
      hasOpenDeployment?: boolean;
      hasClosedDeployment?: boolean;
      isUserWallet?: boolean;
    }) => {
      const seeded = input.isUserWallet === false ? undefined : (await seedUserWithWallet()).wallet;
      const address = seeded?.address ?? createAkashAddress();

      if (input.hasDepositGrant) chain.depositGrantees.add(address);
      if (input.hasFeeAllowance) chain.feeGrantees.add(address);
      if (input.hasOpenDeployment) await createDeployment({ owner: address, closedHeight: undefined });
      if (input.hasClosedDeployment) await createDeployment({ owner: address, closedHeight: 5_000_000 });

      return { id: seeded?.id ?? 0, address };
    };

    const seedMove = async (status: FundingWalletMoveStatus) => {
      const { wallet } = await seedUserWithWallet();

      return await container.resolve(FundingWalletMoveRepository).createUnlessStarted({
        userWalletId: wallet.id,
        network,
        fromFundingWalletId: draining.id,
        toFundingWalletId: active.id,
        status,
        readLimit: 0,
        readHeight: 1,
        feeLimit: 0,
        feeExpiresAt: null
      });
    };

    const findQueuedMoves = async () => {
      const jobTable = sql`${sql.identifier(container.resolve(CoreConfigService).get("POSTGRES_BACKGROUND_JOBS_SCHEMA"))}.job`;
      const rows = await db.execute(
        sql`select (data->>'userWalletId')::int as "userWalletId", singleton_key as "singletonKey", priority,
              extract(epoch from start_after - now()) / 60 as "startsWithinMinutes"
            from ${jobTable} where name = ${MOVE} and state = 'created'`
      );

      return rows.map(row => ({ ...row, startsWithinMinutes: Number(row.startsWithinMinutes) })) as {
        userWalletId: number;
        singletonKey: string;
        priority: number;
        startsWithinMinutes: number;
      }[];
    };

    const findStatus = async () => {
      const [wallet] = await db.select({ status: fundingWalletsTable.status }).from(fundingWalletsTable).where(eq(fundingWalletsTable.id, draining.id));

      return wallet.status;
    };

    return { service: container.resolve(FundingWalletDrainService), network, draining, active, chain, seedGrantee, seedMove, findQueuedMoves, findStatus };
  }
});
