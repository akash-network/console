import { faker } from "@faker-js/faker";
import { subHours } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { CHAIN_DB } from "@src/chain";
import { JOB_NAME } from "@src/core";
import { MAX_CHECK_ATTEMPTS, MAX_FOLLOW_UP_WRITES, ReconcileDeploymentAllowanceHandler } from "./reconcile-deployment-allowance.handler";
import { type AllowanceCheck, ReconcileDeploymentAllowance } from "./reconcile-deployment-allowance.job";

import { createAkashAddress } from "@test/seeders";
import {
  ensureTransactionEventTables,
  indexAllowanceGrant,
  indexAllowanceRevoke,
  indexBalanceFundedDeposit,
  indexBlock,
  indexGrantFundedDeposit
} from "@test/seeders/deployment-allowance-history.seeder";
import { deleteQueuedJobs, expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const CHECK = ReconcileDeploymentAllowance[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(ReconcileDeploymentAllowanceHandler)]);

describe(ReconcileDeploymentAllowanceHandler.name, () => {
  const readLimit = 500_000_000;
  const credit = 100_000_000;

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteQueuedJobs(CHECK);
  });

  describe("when the write landed", () => {
    it.each([
      { draw: "leaves part of the grant", exhaustsGrant: false },
      { draw: "uses up the grant", exhaustsGrant: true }
    ])("lowers the allowance by exactly a deposit between the read and the write that $draw, run the way a worker runs it", async ({ exhaustsGrant }) => {
      const { chain, readHeight, index, check, runCheck, findChecksOf, followUpHash } = await setup();
      await index.deposit({ height: readHeight + 2, amount: 30_000_000, exhaustsGrant });
      const write = await check({ landedAt: readHeight + 4 });

      await runCheck(write);

      expect(chain.limit).toBe(readLimit + credit - 30_000_000);
      expect(await findChecksOf(followUpHash)).toEqual([
        expect.objectContaining({
          state: "created",
          data: expect.objectContaining({
            write: expect.objectContaining({ txHash: followUpHash, readHeight: chain.height, readLimit: readLimit + credit }),
            adjustment: -30_000_000,
            round: 1,
            attempt: 0
          })
        })
      ]);
    });

    it("changes nothing for deposits outside the window or not drawn on the grant", async () => {
      const { chain, readHeight, granter, wallet, index, check, handle, findChecksOf, followUpHash, grant } = await setup();
      const otherGrantee = createAkashAddress();
      await index.deposit({ height: readHeight, amount: 1_000_000 });
      await index.deposit({ height: readHeight + 4, txIndex: 1, amount: 2_000_000 });
      await index.deposit({ height: readHeight + 5, amount: 3_000_000 });
      await index.deposit({ height: readHeight + 2, amount: 4_000_000, hasProcessingError: true });
      await indexGrantFundedDeposit({ granter, grantee: otherGrantee, denom: index.denom, amount: 5_000_000, height: readHeight + 2, txIndex: 1 });
      await indexGrantFundedDeposit({
        granter: createAkashAddress(),
        grantee: wallet.address,
        denom: index.denom,
        amount: 6_000_000,
        height: readHeight + 2,
        txIndex: 2
      });
      await indexBalanceFundedDeposit({ grantee: wallet.address, denom: index.denom, amount: 7_000_000, height: readHeight + 2, txIndex: 3 });
      await index.deposit({ height: readHeight + 2, txIndex: 4, amount: 8_000_000, denom: "uother" });
      const write = await check({ landedAt: readHeight + 4 });

      await handle(write);

      expect(grant).not.toHaveBeenCalled();
      expect(chain.limit).toBe(readLimit + credit);
      expect(await findChecksOf(followUpHash)).toEqual([]);
    });

    it("restores a grant another write landed inside the window, with the deposits that followed it", async () => {
      const { chain, readHeight, index, check, handle } = await setup();
      await index.grant({ height: readHeight + 1, limit: 450_000_000 });
      await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
      const write = await check({ landedAt: readHeight + 4 });

      await handle(write);

      expect(chain.limit).toBe(readLimit + credit + (450_000_000 - 30_000_000 - readLimit));
    });

    it("restores a revoke another write landed inside the window", async () => {
      const { chain, readHeight, index, check, handle } = await setup();
      await index.revoke({ height: readHeight + 1 });
      const write = await check({ landedAt: readHeight + 4 });

      await handle(write);

      expect(chain.limit).toBe(credit);
    });

    it("checks each follow-up write the same way, until its window holds nothing", async () => {
      const { chain, readHeight, index, check, handle, findChecksOf, followUpHash } = await setup();
      await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
      await handle(await check({ landedAt: readHeight + 4 }));
      const [{ data: firstFollowUp }] = await findChecksOf<AllowanceCheck>(followUpHash);
      await index.deposit({ height: firstFollowUp.write.readHeight + 1, amount: 5_000_000 });
      await index.grant({ height: firstFollowUp.write.readHeight + 2, limit: chain.limit, hash: followUpHash });
      const secondFollowUpHash = chain.nextHash();
      chain.height += 10;

      await handle(firstFollowUp);
      const [{ data: secondFollowUp }] = await findChecksOf<AllowanceCheck>(secondFollowUpHash);
      await index.grant({ height: secondFollowUp.write.readHeight + 2, limit: chain.limit, hash: secondFollowUpHash });
      await handle(secondFollowUp);

      expect(chain.limit).toBe(readLimit + credit - 30_000_000 - 5_000_000);
      expect(secondFollowUp).toMatchObject({ adjustment: -5_000_000, round: 2 });
      expect(await findChecksOf(chain.nextHash())).toEqual([]);
    });

    it("lowers the allowance no further than to nothing when the wallet spent it already", async () => {
      const { chain, readHeight, index, check, handle } = await setup({ currentLimit: 10_000_000 });
      await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
      const write = await check({ landedAt: readHeight + 4 });

      await handle(write);

      expect(chain.limit).toBe(0);
    });

    it("stops at its bound of follow-up writes, run the way a worker runs it", async () => {
      const { chain, readHeight, index, check, runCheck, findChecksOf, followUpHash } = await setup();
      await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
      const write = await check({ landedAt: readHeight + 4, round: MAX_FOLLOW_UP_WRITES });

      await runCheck(write);

      expect(chain.limit).toBe(readLimit + credit);
      expect(await findChecksOf(followUpHash)).toEqual([]);
    });

    it("makes one more follow-up write below its bound", async () => {
      const { chain, readHeight, index, check, handle, findChecksOf, followUpHash } = await setup();
      await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
      const write = await check({ landedAt: readHeight + 4, round: MAX_FOLLOW_UP_WRITES - 1 });

      await handle(write);

      expect(chain.limit).toBe(readLimit + credit - 30_000_000);
      expect(await findChecksOf(followUpHash)).toEqual([expect.objectContaining({ data: expect.objectContaining({ round: MAX_FOLLOW_UP_WRITES }) })]);
    });
  });

  describe("when the chain index holds no write yet", () => {
    it("checks again later while the write may still land", async () => {
      const { chain, check, handle, findChecksOf } = await setup();
      await indexTip(new Date());
      const write = await check({ adjustment: -30_000_000 });

      await handle(write);

      expect(chain.limit).toBe(readLimit + credit);
      expect(await findChecksOf(write.write.txHash)).toEqual([expect.objectContaining({ data: expect.objectContaining({ ...write, attempt: 1 }) })]);
    });

    it("gives up after its last attempt", async () => {
      const { check, handle, findChecksOf } = await setup();
      await indexTip(new Date());
      const write = await check({ adjustment: -30_000_000, attempt: MAX_CHECK_ATTEMPTS });

      await handle(write);

      expect(await findChecksOf(write.write.txHash)).toEqual([]);
    });

    it("writes the adjustment again once the index has passed the write's landing window", async () => {
      const { chain, check, handle, findChecksOf, followUpHash } = await setup();
      await indexTip(new Date());
      const write = await check({ adjustment: -30_000_000, round: 1, sentAt: subHours(new Date(), 1) });

      await handle(write);

      expect(chain.limit).toBe(readLimit + credit - 30_000_000);
      expect(await findChecksOf(followUpHash)).toEqual([expect.objectContaining({ data: expect.objectContaining({ adjustment: -30_000_000, round: 2 }) })]);
    });

    it("ends with a write whose own caller retries it once that write can no longer land", async () => {
      const { chain, check, handle, grant } = await setup();
      await indexTip(new Date());
      const write = await check({ sentAt: subHours(new Date(), 1) });

      await handle(write);

      expect(grant).not.toHaveBeenCalled();
      expect(chain.limit).toBe(readLimit + credit);
    });
  });

  it("writes the adjustment again when the chain refused the write", async () => {
    const { chain, readHeight, check, handle } = await setup();
    const write = await check({ landedAt: readHeight + 4, hasProcessingError: true, adjustment: -30_000_000, round: 1 });

    await handle(write);

    expect(chain.limit).toBe(readLimit + credit - 30_000_000);
  });

  it("grants nothing on a retried run, which cannot tell whether the run before it got a grant out", async () => {
    const { chain, readHeight, index, check, handle, findChecksOf } = await setup();
    await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
    const write = await check({ landedAt: readHeight + 4 });

    await handle(write, { retryCount: 1 });

    expect(chain.limit).toBe(readLimit + credit);
    expect(await findChecksOf(write.write.txHash)).toEqual([]);
  });

  describe("when the follow-up write fails", () => {
    it("checks the write again when the signer shows nothing was granted", async () => {
      const { readHeight, index, check, handle, findChecksOf, grant } = await setup();
      await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
      const write = await check({ landedAt: readHeight + 4 });
      grant.mockRejectedValueOnce(new Error("signer unavailable"));

      await handle(write);

      expect(await findChecksOf(write.write.txHash)).toEqual([expect.objectContaining({ data: expect.objectContaining({ attempt: 1 }) })]);
    });

    it("checks the write again when the chain refused the follow-up grant", async () => {
      const { readHeight, index, check, handle, findChecksOf, grant } = await setup();
      await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
      const write = await check({ landedAt: readHeight + 4 });
      grant.mockResolvedValueOnce({ code: 11, hash: faker.string.hexadecimal({ length: 64, prefix: "" }), rawLog: "out of gas" });

      await handle(write);

      expect(await findChecksOf(write.write.txHash)).toEqual([expect.objectContaining({ data: expect.objectContaining({ attempt: 1 }) })]);
    });

    it("watches a follow-up grant the signer could not decide by its hash instead of granting again", async () => {
      const { readHeight, index, check, handle, findChecksOf, grant } = await setup();
      await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
      const write = await check({ landedAt: readHeight + 4 });
      const undecidedHash = faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase();
      grant.mockRejectedValueOnce(new TxOutcomeUnknownError(undecidedHash));

      await handle(write);

      expect(await findChecksOf(write.write.txHash)).toEqual([]);
      expect(await findChecksOf(undecidedHash)).toEqual([expect.objectContaining({ data: expect.objectContaining({ adjustment: -30_000_000, round: 1 }) })]);
    });

    it("stops when the signer could not decide a follow-up grant it gave no hash for", async () => {
      const { readHeight, index, check, handle, findChecksOf, grant } = await setup();
      await index.deposit({ height: readHeight + 2, amount: 30_000_000 });
      const write = await check({ landedAt: readHeight + 4 });
      grant.mockRejectedValueOnce(new TxOutcomeUnknownError());

      await handle(write);

      expect(await findChecksOf(write.write.txHash)).toEqual([]);
    });
  });

  let tipHeight = 2_100_000_000;

  async function indexTip(at: Date) {
    container.resolve(CHAIN_DB);
    await indexBlock(++tipHeight, at);
  }

  function uniqueHash() {
    return faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase();
  }

  async function setup(input: { currentLimit?: number } = {}) {
    container.resolve(CHAIN_DB);
    await ensureTransactionEventTables();
    await jobWorkers();
    const granter = createAkashAddress();
    const wallet = { id: faker.number.int({ min: 1, max: 1_000_000 }), address: createAkashAddress() };
    const denom = container.resolve(BillingConfigService).get("DEPLOYMENT_GRANT_DENOM");
    const readHeight = faker.number.int({ min: 50_000_000, max: 2_000_000_000 });
    const hashes = [uniqueHash()];
    const chain = {
      limit: input.currentLimit ?? readLimit + credit,
      height: readHeight + 50,
      nextHash: () => hashes[0]
    };
    const followUpHash = chain.nextHash();

    vi.spyOn(container.resolve(TxManagerService), "getFundingWalletAddress").mockResolvedValue(granter);
    vi.spyOn(container.resolve(BalancesService), "retrieveDeploymentLimitAtLatestHeight").mockImplementation(async () => ({
      limit: chain.limit,
      height: chain.height
    }));
    const grant = vi.spyOn(container.resolve(ManagedUserWalletService), "authorizeDeploymentSpendingOnly").mockImplementation(async (_signer, { limit }) => {
      chain.limit = limit;
      const [hash] = hashes.splice(0, 1, uniqueHash());
      return { code: 0, hash, rawLog: "" };
    });

    const index = {
      denom,
      deposit: (at: Omit<Parameters<typeof indexGrantFundedDeposit>[0], "granter" | "grantee" | "denom"> & { denom?: string }) =>
        indexGrantFundedDeposit({ granter, grantee: wallet.address, denom, ...at }),
      grant: (at: Omit<Parameters<typeof indexAllowanceGrant>[0], "granter" | "grantee" | "denom">) =>
        indexAllowanceGrant({ granter, grantee: wallet.address, denom, ...at }),
      revoke: (at: Omit<Parameters<typeof indexAllowanceRevoke>[0], "granter" | "grantee">) => indexAllowanceRevoke({ granter, grantee: wallet.address, ...at })
    };

    const check = async ({
      landedAt,
      hasProcessingError,
      sentAt = new Date(),
      adjustment = 0,
      round = 0,
      attempt = 0
    }: {
      landedAt?: number;
      hasProcessingError?: boolean;
      sentAt?: Date;
      adjustment?: number;
      round?: number;
      attempt?: number;
    }): Promise<AllowanceCheck> => {
      const txHash = uniqueHash();
      if (landedAt)
        await indexAllowanceGrant({ granter, grantee: wallet.address, denom, limit: readLimit + credit, height: landedAt, hash: txHash, hasProcessingError });

      return { wallet, write: { txHash, readHeight, readLimit, sentAt: sentAt.toISOString() }, adjustment, round, attempt };
    };

    const handle = (payload: AllowanceCheck, job: { retryCount?: number } = {}) =>
      container
        .resolve(ReconcileDeploymentAllowanceHandler)
        .handle({ ...payload, version: 1 }, { id: faker.string.uuid(), retryCount: job.retryCount ?? 0, retryLimit: 5 });

    const runCheck = async (payload: AllowanceCheck) => {
      const { enqueue, startWorkers } = await jobWorkers();
      const singletonKey = `${CHECK}.${payload.write.txHash}.run`;
      await enqueue(new ReconcileDeploymentAllowance(payload), { singletonKey });
      await startWorkers();
      await expectJobCompleted(CHECK, { singletonKey });
    };

    const findChecksOf = <T = AllowanceCheck>(txHash: string) => findJobRows<T>(CHECK, { singletonKeyLike: `${CHECK}.${txHash}.%`, state: "created" });

    return { chain, granter, wallet, readHeight, index, check, handle, runCheck, findChecksOf, followUpHash, grant };
  }
});
