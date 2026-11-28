import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FundingWalletMoveRepository, FundingWalletRefundRepository, FundingWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { ReconcileDeploymentAllowance } from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.job";
import { CHAIN_DB } from "@src/chain";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { CreditReturnedEscrowHandler } from "./credit-returned-escrow.handler";
import { CreditReturnedEscrow } from "./credit-returned-escrow.job";
import { ReturnedEscrowService } from "./returned-escrow.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { ensureTransactionEventTables, indexRefundLeftWithGranter } from "@test/seeders/deployment-allowance-history.seeder";
import { deleteCompletedJobs, deleteQueuedJobs, expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const CREDIT = CreditReturnedEscrow[JOB_NAME];
const CHECK = ReconcileDeploymentAllowance[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(CreditReturnedEscrowHandler)]);

describe(CreditReturnedEscrowHandler.name, () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteQueuedJobs(CREDIT);
    await deleteCompletedJobs(CREDIT);
    await deleteQueuedJobs(CHECK);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    await db.delete(resolveTable("FundingWalletRefunds"));
    await db.delete(resolveTable("FundingWalletMoves"));
    await db.delete(resolveTable("UserWalletGranters"));
    await db.delete(resolveTable("FundingWallets"));
  });

  it("adds the escrow a deployment returned to the old funding wallet to the user's balance on the new one, run the way a worker runs it", async () => {
    const { chain, index, runCredit, findRefunds } = await setup();
    const close = await index.refund({ amount: 500_000, height: chain.readHeight + 5 });

    await runCredit({ closeTxHash: close.txHash });

    expect(chain.limit).toBe(1_000_000 + 500_000);
    await expect(findRefunds()).resolves.toEqual([expect.objectContaining({ txHash: close.txHash, msgIndex: 0, amount: 500_000, status: "credited" })]);
  });

  it("credits each close once, however often it runs", async () => {
    const { chain, index, handle, findRefunds } = await setup();
    await index.refund({ amount: 500_000, height: chain.readHeight + 5 });
    await handle();
    await index.refund({ amount: 200_000, height: chain.readHeight + 8 });

    await handle();
    await handle();

    expect(chain.limit).toBe(1_000_000 + 500_000 + 200_000);
    expect(chain.grants).toBe(2);
    expect((await findRefunds()).map(refund => refund.status)).toEqual(["credited", "credited"]);
  });

  it("credits nothing for a close whose refund the old grant took back, or that came before the move read the balance", async () => {
    const { chain, index, handle, findRefunds } = await setup();
    await index.refund({ amount: 500_000, height: chain.readHeight + 5, isGrantSavedAgain: true });
    await index.refund({ amount: 300_000, height: chain.readHeight });

    await handle();

    expect(chain.limit).toBe(1_000_000);
    await expect(findRefunds()).resolves.toEqual([]);
  });

  it("credits nothing for a user whose move has not completed", async () => {
    const { chain, index, handle, findRefunds } = await setup({ moveStatus: "failed" });
    await index.refund({ amount: 500_000, height: chain.readHeight + 5 });

    await handle();

    expect(chain.limit).toBe(1_000_000);
    await expect(findRefunds()).resolves.toEqual([]);
  });

  it("fails, to be retried, while the chain index does not hold the close it was queued for", async () => {
    const { chain, handle } = await setup();

    await expect(handle({ closeTxHash: faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase() })).rejects.toMatchObject({ status: 503 });

    expect(chain.limit).toBe(1_000_000);
  });

  it("fails, to be retried, while the chain index holds the close it was queued for and has not tied it to its deployment yet", async () => {
    const { chain, index, handle, findRefunds } = await setup();
    const close = await index.refund({ amount: 500_000, height: chain.readHeight + 5, isProcessed: false, isTiedToDeployment: false });

    await expect(handle({ closeTxHash: close.txHash })).rejects.toMatchObject({ status: 503, closeTxHash: close.txHash });

    expect(chain.limit).toBe(1_000_000);
    await expect(findRefunds()).resolves.toEqual([]);
  });

  it("queues a check for every user moved off a funding wallet, each of which credits that user", async () => {
    const { chain, draining, index, findRefunds } = await setup();
    const close = await index.refund({ amount: 500_000, height: chain.readHeight + 5 });
    const { startWorkers } = await jobWorkers();

    await expect(container.resolve(ReturnedEscrowService).queueForEveryoneMovedOff(draining.address)).resolves.toEqual({ queued: 1 });
    await startWorkers();
    await expectJobCompleted(CREDIT);

    expect(chain.limit).toBe(1_000_000 + 500_000);
    await expect(findRefunds()).resolves.toEqual([expect.objectContaining({ txHash: close.txHash, status: "credited" })]);
  });

  async function setup(input: { moveStatus?: "completed" | "failed" } = {}) {
    container.resolve(CHAIN_DB);
    await ensureTransactionEventTables();
    const network = container.resolve(CoreConfigService).get("NETWORK");
    const denom = container.resolve(BillingConfigService).get("DEPLOYMENT_GRANT_DENOM");
    const fundingWallets = container.resolve(FundingWalletRepository);
    const { wallet: seeded } = await seedUserWithWallet();
    const wallet = { id: seeded.id, address: seeded.address! };
    const draining = await fundingWallets.create({ network, address: createAkashAddress(), status: "draining" });
    const active = await fundingWallets.create({ network, address: createAkashAddress(), status: "active" });
    await fundingWallets.reassign({ userWalletId: wallet.id, network, fundingWalletId: active.id });
    const chain = { limit: 1_000_000, grants: 0, readHeight: faker.number.int({ min: 50_000_000, max: 2_000_000_000 }) };
    const move = await container.resolve(FundingWalletMoveRepository).createUnlessStarted({
      userWalletId: wallet.id,
      network,
      fromFundingWalletId: draining.id,
      toFundingWalletId: active.id,
      status: input.moveStatus ?? "completed",
      readLimit: 1_000_000,
      readHeight: chain.readHeight,
      feeLimit: 0,
      feeExpiresAt: null
    });

    vi.spyOn(container.resolve(BalancesService), "retrieveDeploymentLimitAtLatestHeight").mockImplementation(async () => ({
      limit: chain.limit,
      height: chain.readHeight + 100,
      granter: active.address
    }));
    vi.spyOn(container.resolve(ManagedUserWalletService), "authorizeDeploymentSpendingOnly").mockImplementation(async (_signer, { limit }) => {
      chain.limit = limit;
      chain.grants += 1;

      return { code: 0, hash: faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase(), rawLog: "" };
    });

    const index = {
      refund: (at: { amount: number; height: number; isGrantSavedAgain?: boolean; isProcessed?: boolean; isTiedToDeployment?: boolean }) =>
        indexRefundLeftWithGranter({ granter: draining.address, owner: wallet.address, denom, ...at })
    };

    const handle = (payload: { closeTxHash?: string } = {}) =>
      container.resolve(CreditReturnedEscrowHandler).handle({ userWalletId: wallet.id, version: 1, ...payload });

    const runCredit = async (payload: { closeTxHash?: string } = {}) => {
      const { enqueue, startWorkers } = await jobWorkers();
      await enqueue(new CreditReturnedEscrow({ userWalletId: wallet.id, ...payload }));
      await startWorkers();
      await expectJobCompleted(CREDIT);
    };

    const findRefunds = () => container.resolve(FundingWalletRefundRepository).findByMove(move.id);

    return { chain, wallet, draining, active, index, handle, runCredit, findRefunds };
  }
});
