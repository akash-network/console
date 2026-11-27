import { AuthzHttpService, type FeeAllowance } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { FundingWalletMoveRepository } from "@src/billing/repositories/funding-wallet-move/funding-wallet-move.repository";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { ReconcileDeploymentAllowanceHandler } from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.handler";
import { type AllowanceCheck, ReconcileDeploymentAllowance } from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.job";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { MoveUserToActiveFundingWalletHandler } from "./move-user-to-active-funding-wallet.handler";
import { MoveUserToActiveFundingWallet } from "./move-user-to-active-funding-wallet.job";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const MOVE = MoveUserToActiveFundingWallet[JOB_NAME];
const CHECK = ReconcileDeploymentAllowance[JOB_NAME];
const FEE_EXPIRATION = new Date("2030-01-01T00:00:00.000Z");

const jobWorkers = useJobWorkers(() => [container.resolve(MoveUserToActiveFundingWalletHandler), container.resolve(ReconcileDeploymentAllowanceHandler)]);

describe(MoveUserToActiveFundingWalletHandler.name, () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteQueuedJobs(MOVE);
    await deleteQueuedJobs(CHECK);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    await db.delete(resolveTable("FundingWalletMoves"));
    await db.delete(resolveTable("UserWalletGranters"));
    await db.delete(resolveTable("FundingWallets"));
  });

  it("moves a user's balance and fee allowance to the active funding wallet, run the way a worker runs it", async () => {
    const { chain, wallet, draining, active, network, runMove, findMove } = await setup({ deposit: 5_000_000, fees: 700_000 });

    await runMove();

    expect(chain.depositOf(draining.address)).toBe(0);
    expect(chain.depositOf(active.address)).toBe(5_000_000);
    expect(chain.feesOf(draining.address)).toBeUndefined();
    expect(chain.feesOf(active.address)).toEqual({ limit: 700_000, expiration: FEE_EXPIRATION });
    await expect(container.resolve(FundingWalletRepository).findGranterOf(wallet.id, network)).resolves.toMatchObject({ id: active.id });
    await expect(findMove()).resolves.toMatchObject({
      status: "completed",
      toFundingWalletId: active.id,
      readLimit: 5_000_000,
      readHeight: chain.readHeight,
      feeLimit: 700_000,
      revokeTxHash: chain.revokeHashes[0],
      failure: null
    });
  });

  it("queues a check that replays the old grant up to its revoke, and one for the credit that repeats it if it never lands", async () => {
    const { chain, wallet, draining, active, runMove } = await setup({ deposit: 5_000_000 });

    await runMove();

    const checks = await findJobRows<AllowanceCheck>(CHECK, { state: "created" });
    expect(checks.map(check => check.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          wallet: { id: wallet.id, address: wallet.address },
          write: expect.objectContaining({ txHash: chain.revokeHashes[0], readHeight: chain.readHeight, readLimit: 5_000_000, granter: draining.address }),
          adjustment: 0
        }),
        expect.objectContaining({
          write: expect.objectContaining({ txHash: chain.grantHashes[0], readLimit: 0, granter: active.address }),
          adjustment: 5_000_000
        })
      ])
    );
    expect(checks).toHaveLength(2);
  });

  it("credits once when the first credit is refused and the move runs again", async () => {
    const { chain, active, handle, findMove, grantDeposit } = await setup({ deposit: 5_000_000 });
    grantDeposit.mockResolvedValueOnce({ code: 5, hash: chain.nextHash(), rawLog: "refused" });

    await expect(handle()).rejects.toMatchObject({ status: 502 });
    await expect(findMove()).resolves.toMatchObject({ status: "revoked" });
    expect(chain.depositOf(active.address)).toBe(0);

    await handle();
    await handle();

    expect(chain.depositOf(active.address)).toBe(5_000_000);
    expect(chain.grantHashes).toHaveLength(1);
    await expect(findMove()).resolves.toMatchObject({ status: "completed" });
  });

  it("grants nothing more for a move that stopped while its credit may have been sent, and leaves it for review", async () => {
    const { chain, wallet, draining, active, network, handle, findMove } = await setup();
    await container.resolve(FundingWalletMoveRepository).createUnlessStarted({
      userWalletId: wallet.id,
      network,
      fromFundingWalletId: draining.id,
      toFundingWalletId: active.id,
      status: "crediting",
      readLimit: 5_000_000,
      readHeight: chain.readHeight,
      feeLimit: 0,
      feeExpiresAt: null
    });

    await handle();

    expect(chain.depositOf(active.address)).toBe(0);
    expect(chain.grantHashes).toEqual([]);
    await expect(findMove()).resolves.toMatchObject({ status: "failed", failure: expect.stringContaining("interrupted") });
  });

  it("moves nothing while a grant signed before the promotion can still land", async () => {
    const { chain, draining, active, handle, findMove } = await setup({ deposit: 5_000_000, drainingSince: sql`now()` });

    await expect(handle()).rejects.toMatchObject({ status: 503 });

    expect(chain.depositOf(draining.address)).toBe(5_000_000);
    expect(chain.depositOf(active.address)).toBe(0);
    await expect(findMove()).resolves.toBeUndefined();
  });

  it("moves a grant whose user wallet was never recorded on the draining wallet", async () => {
    const { chain, wallet, draining, active, network, handle } = await setup({ deposit: 5_000_000, isAssigned: false });

    await handle();

    expect(chain.depositOf(draining.address)).toBe(0);
    expect(chain.depositOf(active.address)).toBe(5_000_000);
    await expect(container.resolve(FundingWalletRepository).findGranterOf(wallet.id, network)).resolves.toMatchObject({ id: active.id });
  });

  it("refuses a new grant for a user who is still on the draining wallet, and grants from the active one after the move", async () => {
    const { wallet, active, handle } = await setup({ deposit: 5_000_000 });
    const registry = container.resolve(FundingWalletRegistryService);

    await expect(registry.assignGranterAddress(wallet.id)).rejects.toMatchObject({ status: 503 });

    await handle();

    await expect(registry.assignGranterAddress(wallet.id)).resolves.toBe(active.address);
  });

  async function setup(input: { deposit?: number; fees?: number; drainingSince?: ReturnType<typeof sql>; isAssigned?: boolean } = {}) {
    const network = container.resolve(CoreConfigService).get("NETWORK");
    const fundingWallets = container.resolve(FundingWalletRepository);
    const registry = container.resolve(FundingWalletRegistryService);
    const table = resolveTable("FundingWallets");
    const { wallet: seeded } = await seedUserWithWallet();
    const wallet = { id: seeded.id, address: seeded.address! };
    const draining = await fundingWallets.create({ network, address: createAkashAddress(), status: "draining" });
    const active = await fundingWallets.create({ network, address: createAkashAddress(), status: "active" });
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .update(table)
      .set({ updatedAt: input.drainingSince ?? sql`now() - interval '1 hour'` })
      .where(eq(table.id, draining.id));
    if (input.isAssigned ?? true) await fundingWallets.reassign({ userWalletId: wallet.id, network, fundingWalletId: draining.id });

    const deposits = new Map<string, number>(input.deposit ? [[draining.address, input.deposit]] : []);
    const fees = new Map<string, { limit: number; expiration?: Date }>(
      input.fees ? [[draining.address, { limit: input.fees, expiration: FEE_EXPIRATION }]] : []
    );
    const chain = {
      readHeight: faker.number.int({ min: 50_000_000, max: 2_000_000_000 }),
      revokeHashes: [] as string[],
      grantHashes: [] as string[],
      nextHash: () => faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase(),
      depositOf: (granter: string) => deposits.get(granter) ?? 0,
      feesOf: (granter: string) => fees.get(granter)
    };
    const authz = container.resolve(AuthzHttpService);
    const managedUserWalletService = container.resolve(ManagedUserWalletService);

    vi.spyOn(container.resolve(BalancesService), "retrieveDeploymentLimitAtLatestHeight").mockImplementation(async ({ address }, options) => {
      const granter = options?.granter ?? (await registry.getGranterAddressByWalletAddress(address!));
      return { limit: chain.depositOf(granter), height: chain.readHeight, granter };
    });
    vi.spyOn(authz, "hasDepositDeploymentGrant").mockImplementation(async granter => deposits.has(granter));
    vi.spyOn(authz, "hasFeeAllowance").mockImplementation(async granter => fees.has(granter));
    vi.spyOn(authz, "getFeeAllowanceForGranterAndGrantee").mockImplementation(async (granter, grantee) => {
      const allowance = fees.get(granter);
      const feeAllowance: FeeAllowance | undefined = allowance && {
        granter,
        grantee,
        allowance: {
          "@type": "/cosmos.feegrant.v1beta1.BasicAllowance",
          spend_limit: [{ denom: "uakt", amount: String(allowance.limit) }],
          expiration: allowance.expiration?.toISOString() ?? ""
        }
      };

      return feeAllowance;
    });
    vi.spyOn(container.resolve(ManagedSignerService), "executeFundingTx").mockImplementation(async messages => {
      for (const { typeUrl, value } of messages) {
        const { granter } = value as { granter: string };
        if (typeUrl.endsWith("MsgRevokeAllowance")) fees.delete(granter);
        else deposits.delete(granter);
      }
      chain.revokeHashes.push(chain.nextHash());

      return { code: 0, hash: chain.revokeHashes.at(-1)!, rawLog: "" };
    });
    vi.spyOn(managedUserWalletService, "authorizeSpending").mockImplementation(async (_signer, options) => {
      fees.set(await registry.assignGranterAddress(options.derivationIndex), { limit: options.limits.fees, expiration: options.expiration });
    });
    const grantDeposit = vi
      .spyOn(managedUserWalletService, "authorizeDeploymentSpendingOnly")
      .mockImplementation(async (_signer, { derivationIndex, limit }) => {
        deposits.set(await registry.assignGranterAddress(derivationIndex), limit);
        chain.grantHashes.push(chain.nextHash());

        return { code: 0, hash: chain.grantHashes.at(-1)!, rawLog: "" };
      });

    const handle = () => container.resolve(MoveUserToActiveFundingWalletHandler).handle({ userWalletId: wallet.id, version: 1 });

    const runMove = async () => {
      const { enqueue, startWorkers } = await jobWorkers();
      const singletonKey = `${MOVE}.${network}.${wallet.id}`;
      await enqueue(new MoveUserToActiveFundingWallet({ userWalletId: wallet.id }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(MOVE, { singletonKey });
    };

    const findMove = () => container.resolve(FundingWalletMoveRepository).findBySource({ userWalletId: wallet.id, network, fromFundingWalletId: draining.id });

    return { chain, wallet, draining, active, network, handle, runMove, findMove, grantDeposit };
  }
});
