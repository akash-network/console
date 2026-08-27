import { and, eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { ApiPgDatabase } from "@src/core";
import { CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { TopUpSummarizer } from "@src/deployment/lib/top-up-summarizer/top-up-summarizer";
import { UserRepository } from "@src/user/repositories";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { TopUpManagedDeploymentsService } from "./top-up-managed-deployments.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";

const CURRENT_HEIGHT = 1000000;
const CLOSED_HEIGHT = String(CURRENT_HEIGHT - 500);
const DENOM = "uakt";
const BLOCK_RATE = 50;
const ESCROW_AMOUNT = "50000";
/** Mirrors the `AUTO_TOP_UP_BALANCE_HEADROOM_IN_USD` default of $5, in the grant denom's micro units. */
const HEADROOM_UDENOM = 5000000;
const NEARLY_DRAINED_ESCROW_AMOUNT = "1000";
const ALLOWANCE_ABOVE_HEADROOM_BELOW_A_COOLDOWN = 20000;

type DepositMessage = { value: { deposit?: { amount?: { amount: string } } } };

function dseqOf(message: unknown): string {
  return String((message as { value: { id: { xid: string } } }).value.id.xid).split("/")[1];
}

/** Flattens every deposit message broadcast across all txs into the numeric amounts they carry. */
function depositedAmounts(executeDerivedTx: { mock: { calls: unknown[][] } }): number[] {
  return executeDerivedTx.mock.calls.flatMap(call => call[1] as DepositMessage[]).map(message => Number(message.value.deposit?.amount?.amount));
}

/**
 * This test defines the business rules for the auto top-up job.
 * Internal implementation changes (RPC queries, DB fallback, caching, etc.)
 * should conform to these tests passing. Only update these tests
 * when the business rules themselves change.
 */
describe(TopUpManagedDeploymentsService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("topUpDeployments", () => {
    // Owner has two deployment settings with auto top-up enabled.
    // One deployment is active and draining, the other is closed on chain.
    // The draining deployment should receive a deposit transaction.
    // The closed deployment should be marked as closed in the DB to disable future top-ups.
    it("tops up draining deployment and marks closed-on-chain deployment as closed", async () => {
      const {
        topUpService,
        executeDerivedTx,
        createUserWithWallet,
        createDeploymentSetting,
        findSetting,
        mockLeasesForOwner,
        mockDeploymentsForOwner,
        stubGetFreshLimits
      } = await setup();
      const { user, wallet, address } = await createUserWithWallet();
      const drainingDseq = "100001";
      const closedOnChainDseq = "100002";

      await createDeploymentSetting(user.id, drainingDseq);
      await createDeploymentSetting(user.id, closedOnChainDseq);

      mockLeasesForOwner(address, [createActiveLease(address, drainingDseq), createClosedLease(address, closedOnChainDseq)]);
      mockDeploymentsForOwner(address, [createActiveDeployment(address, drainingDseq), createClosedDeployment(address, closedOnChainDseq)]);
      stubGetFreshLimits({ [address]: 10000000 });
      const inc = vi.spyOn(TopUpSummarizer.prototype, "inc");

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).toHaveBeenCalledOnce();
      expect(executeDerivedTx).toHaveBeenCalledWith(
        wallet.id,
        expect.arrayContaining([
          expect.objectContaining({
            value: expect.objectContaining({ id: expect.objectContaining({ xid: expect.stringContaining(`/${drainingDseq}`) }) })
          })
        ])
      );

      const closedSetting = await findSetting(address, closedOnChainDseq);
      expect(closedSetting?.closed).toBe(true);
      expect(inc).toHaveBeenCalledWith("deploymentsMarkedClosedCount", 1);
      expect(inc).toHaveBeenCalledWith("deploymentTopUpCount", 1);
    });

    it("drops a deployment the chain rejects as closed and funds the rest of the batch in the same pass", async () => {
      const {
        topUpService,
        executeDerivedTx,
        chainErrorService,
        createUserWithWallet,
        createDeploymentSetting,
        findSetting,
        mockLeasesForOwner,
        mockDeploymentsForOwner,
        stubGetFreshLimits
      } = await setup();
      const { user, address } = await createUserWithWallet();
      const firstDseq = "400001";
      const secondDseq = "400002";

      await createDeploymentSetting(user.id, firstDseq);
      await createDeploymentSetting(user.id, secondDseq);

      mockLeasesForOwner(address, [createActiveLease(address, firstDseq), createActiveLease(address, secondDseq)], { persist: true });
      mockDeploymentsForOwner(address, [createActiveDeployment(address, firstDseq), createActiveDeployment(address, secondDseq)], { persist: true });
      stubGetFreshLimits({ [address]: 10000000 });

      let closedDseq: string | undefined;
      executeDerivedTx.mockImplementationOnce(async (_walletId, messages) => {
        closedDseq = dseqOf(messages[1]);
        throw await chainErrorService.toAppError(
          new Error(
            "Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 1: Deployment closed with gas used: '33317': unknown request"
          ),
          messages
        );
      });

      const result = await topUpService.topUpDeployments({ dryRun: false });

      expect(result.ok).toBe(true);
      expect(executeDerivedTx).toHaveBeenCalledTimes(2);

      const survivingDseq = closedDseq === firstDseq ? secondDseq : firstDseq;
      expect(executeDerivedTx.mock.calls[1][1].map(dseqOf)).toEqual([survivingDseq]);
      expect((await findSetting(address, closedDseq as string))?.closed).toBe(true);
      expect((await findSetting(address, survivingDseq))?.closed).toBe(false);
    });

    // Owner has two active deployments on chain. One has low escrow and is predicted
    // to close within the job's look-ahead window (draining). The other has a large escrow
    // and won't close any time soon (not yet draining).
    // Only the draining deployment should receive a deposit transaction.
    it("tops up draining deployments and skips not-yet-draining ones", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, wallet, address } = await createUserWithWallet();
      const drainingDseq = "300001";
      const notYetDrainingDseq = "300002";

      await createDeploymentSetting(user.id, drainingDseq);
      await createDeploymentSetting(user.id, notYetDrainingDseq);

      mockLeasesForOwner(address, [createActiveLease(address, drainingDseq), createActiveLease(address, notYetDrainingDseq)]);
      mockDeploymentsForOwner(address, [
        createActiveDeployment(address, drainingDseq),
        createDeploymentInfoSeed({
          owner: address,
          dseq: notYetDrainingDseq,
          state: "active",
          amount: "500000000",
          denom: DENOM,
          createdAt: String(CURRENT_HEIGHT - 100)
        })
      ]);
      stubGetFreshLimits({ [address]: 10000000 });

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).toHaveBeenCalledOnce();
      expect(executeDerivedTx).toHaveBeenCalledWith(
        wallet.id,
        expect.arrayContaining([
          expect.objectContaining({
            value: expect.objectContaining({ id: expect.objectContaining({ xid: expect.stringContaining(`/${drainingDseq}`) }) })
          })
        ])
      );
      expect(executeDerivedTx).not.toHaveBeenCalledWith(
        wallet.id,
        expect.arrayContaining([
          expect.objectContaining({
            value: expect.objectContaining({ id: expect.objectContaining({ xid: expect.stringContaining(`/${notYetDrainingDseq}`) }) })
          })
        ])
      );
    });

    it("deposits only the runway missing from the target rather than a flat window", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, address } = await createUserWithWallet();
      const dseq = "700001";
      const hoursOfRunwayHeld = 12;
      const blocksOfRunwayHeld = averageBlockCountInAnHour * hoursOfRunwayHeld;

      await createDeploymentSetting(user.id, dseq);

      mockLeasesForOwner(address, [createActiveLease(address, dseq)]);
      mockDeploymentsForOwner(address, [
        createDeploymentInfoSeed({
          owner: address,
          dseq,
          state: "active",
          amount: String(blocksOfRunwayHeld * BLOCK_RATE),
          denom: DENOM,
          createdAt: String(CURRENT_HEIGHT)
        })
      ]);
      stubGetFreshLimits({ [address]: 100000000 });

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).toHaveBeenCalledOnce();
      expect(depositedAmounts(executeDerivedTx)).toEqual([BLOCK_RATE * averageBlockCountInAnHour * (48 - hoursOfRunwayHeld)]);
    });

    it("clamps the deposit of a runtime-limited deployment to its remaining runtime", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, address } = await createUserWithWallet();
      const dseq = "710001";
      const hoursOfRunwayHeld = 12;
      const runtimeLimitHours = 30;

      await createDeploymentSetting(user.id, dseq, {
        runtimeLimitHours,
        runtimeEndsAt: new Date(Date.now() + runtimeLimitHours * 3600 * 1000)
      });

      mockLeasesForOwner(address, [createActiveLease(address, dseq)]);
      mockDeploymentsForOwner(address, [
        createDeploymentInfoSeed({
          owner: address,
          dseq,
          state: "active",
          amount: String(averageBlockCountInAnHour * hoursOfRunwayHeld * BLOCK_RATE),
          denom: DENOM,
          createdAt: String(CURRENT_HEIGHT)
        })
      ]);
      stubGetFreshLimits({ [address]: 100000000 });

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).toHaveBeenCalledOnce();
      const [deposited] = depositedAmounts(executeDerivedTx);
      expect(deposited).toBeCloseTo(BLOCK_RATE * averageBlockCountInAnHour * (runtimeLimitHours - hoursOfRunwayHeld), -3);
      expect(deposited).toBeLessThan(BLOCK_RATE * averageBlockCountInAnHour * (48 - hoursOfRunwayHeld));
    });

    it("skips a deployment already funded to its runtime deadline without burning a funding claim", async () => {
      const {
        topUpService,
        executeDerivedTx,
        createUserWithWallet,
        createDeploymentSetting,
        findSetting,
        mockLeasesForOwner,
        mockDeploymentsForOwner,
        stubGetFreshLimits
      } = await setup();
      const { user, address } = await createUserWithWallet();
      const dseq = "710002";

      await createDeploymentSetting(user.id, dseq, {
        runtimeLimitHours: 12,
        runtimeEndsAt: new Date(Date.now() + 3600 * 1000)
      });

      mockLeasesForOwner(address, [createActiveLease(address, dseq)]);
      mockDeploymentsForOwner(address, [
        createDeploymentInfoSeed({
          owner: address,
          dseq,
          state: "active",
          amount: String(averageBlockCountInAnHour * 12 * BLOCK_RATE),
          denom: DENOM,
          createdAt: String(CURRENT_HEIGHT)
        })
      ]);
      stubGetFreshLimits({ [address]: 100000000 });

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).not.toHaveBeenCalled();
      const setting = await findSetting(address, dseq);
      expect(setting?.lastFundedAt).toBeNull();
      expect(setting?.closed).toBe(false);
    });

    it("anchors the runtime countdown when funding a limited deployment the initial funding never anchored", async () => {
      const {
        topUpService,
        executeDerivedTx,
        createUserWithWallet,
        createDeploymentSetting,
        findSetting,
        mockLeasesForOwner,
        mockDeploymentsForOwner,
        stubGetFreshLimits
      } = await setup();
      const { user, address } = await createUserWithWallet();
      const dseq = "710003";
      const runtimeLimitHours = 30;

      await createDeploymentSetting(user.id, dseq, { runtimeLimitHours });

      mockLeasesForOwner(address, [createActiveLease(address, dseq)]);
      mockDeploymentsForOwner(address, [createActiveDeployment(address, dseq)]);
      stubGetFreshLimits({ [address]: 100000000 });

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).toHaveBeenCalledOnce();
      const setting = await findSetting(address, dseq);
      const expectedEndsAt = Date.now() + runtimeLimitHours * 3600 * 1000;
      expect(setting?.runtimeEndsAt).toBeInstanceOf(Date);
      expect(Math.abs((setting!.runtimeEndsAt as Date).getTime() - expectedEndsAt)).toBeLessThan(60_000);
    });

    it("does not persist a runtime deadline during a dry run", async () => {
      const {
        topUpService,
        executeDerivedTx,
        createUserWithWallet,
        createDeploymentSetting,
        findSetting,
        mockLeasesForOwner,
        mockDeploymentsForOwner,
        stubGetFreshLimits
      } = await setup();
      const { user, address } = await createUserWithWallet();
      const dseq = "710004";

      await createDeploymentSetting(user.id, dseq, { runtimeLimitHours: 30 });

      mockLeasesForOwner(address, [createActiveLease(address, dseq)]);
      mockDeploymentsForOwner(address, [createActiveDeployment(address, dseq)]);
      stubGetFreshLimits({ [address]: 100000000 });

      await topUpService.topUpDeployments({ dryRun: true });

      expect(executeDerivedTx).not.toHaveBeenCalled();
      const setting = await findSetting(address, dseq);
      expect(setting?.runtimeEndsAt).toBeNull();
    });

    // Owner has two deployment settings with auto top-up enabled, but both deployments
    // are closed on chain. No transactions should be submitted.
    // Both deployment settings should be marked as closed in the DB.
    it("marks all deployment settings as closed when all deployments are closed on chain", async () => {
      const {
        topUpService,
        executeDerivedTx,
        createUserWithWallet,
        createDeploymentSetting,
        findSetting,
        mockLeasesForOwner,
        mockDeploymentsForOwner,
        stubGetFreshLimits
      } = await setup();
      const { user, address } = await createUserWithWallet();
      const closedOnChainDseq1 = "400001";
      const closedOnChainDseq2 = "400002";

      await createDeploymentSetting(user.id, closedOnChainDseq1);
      await createDeploymentSetting(user.id, closedOnChainDseq2);

      mockLeasesForOwner(address, [createClosedLease(address, closedOnChainDseq1), createClosedLease(address, closedOnChainDseq2)]);
      mockDeploymentsForOwner(address, [createClosedDeployment(address, closedOnChainDseq1), createClosedDeployment(address, closedOnChainDseq2)]);
      stubGetFreshLimits({ [address]: 10000000 });

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).not.toHaveBeenCalled();

      const setting1 = await findSetting(address, closedOnChainDseq1);
      expect(setting1?.closed).toBe(true);
      const setting2 = await findSetting(address, closedOnChainDseq2);
      expect(setting2?.closed).toBe(true);
    });

    // Owner has two deployment settings: one with auto top-up explicitly disabled,
    // and one already marked as closed in the DB from a previous run.
    // Neither should be picked up by the job. No transactions should be submitted.
    it("skips deployments with auto top-up disabled or already marked closed", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting } = await setup();
      const { user } = await createUserWithWallet();
      const disabledAutoTopUpDseq = "600001";
      const alreadyMarkedClosedDseq = "600002";

      await createDeploymentSetting(user.id, disabledAutoTopUpDseq, { autoTopUpEnabled: false });
      await createDeploymentSetting(user.id, alreadyMarkedClosedDseq, { closed: true });

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).not.toHaveBeenCalled();
    });

    // Owner has a draining deployment but their wallet's deployment allowance is zero.
    // The whole owner is skipped in one round: no deposit tx, no funding claim stamped
    // on the settings row, and the job still returns Ok.
    it("handles insufficient user balance by skipping the owner without claiming", async () => {
      const {
        topUpService,
        executeDerivedTx,
        createUserWithWallet,
        createDeploymentSetting,
        findSetting,
        mockLeasesForOwner,
        mockDeploymentsForOwner,
        stubGetFreshLimits
      } = await setup();
      const { user, address } = await createUserWithWallet();
      const drainingDseq = "700001";

      await createDeploymentSetting(user.id, drainingDseq);

      mockLeasesForOwner(address, [createActiveLease(address, drainingDseq)]);
      mockDeploymentsForOwner(address, [createActiveDeployment(address, drainingDseq)]);
      stubGetFreshLimits({ [address]: 0 });

      const result = await topUpService.topUpDeployments({ dryRun: false });

      expect(result.ok).toBe(true);
      expect(executeDerivedTx).not.toHaveBeenCalled();
      expect((await findSetting(address, drainingDseq))?.lastFundedAt).toBeNull();
    });

    it("caps the deposit at what sits above the headroom floor so a new deployment can still be created", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, address } = await createUserWithWallet();
      const drainingDseq = "900001";

      await createDeploymentSetting(user.id, drainingDseq);

      mockLeasesForOwner(address, [createActiveLease(address, drainingDseq)]);
      mockDeploymentsForOwner(address, [createActiveDeployment(address, drainingDseq)]);
      stubGetFreshLimits({ [address]: HEADROOM_UDENOM + 500000 });

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).toHaveBeenCalledOnce();
      expect(depositedAmounts(executeDerivedTx)).toEqual([500000]);
    });

    it("spends into the headroom floor rather than leave a deployment minutes from closing unfunded", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, address } = await createUserWithWallet();
      const drainingDseq = "900003";
      const available = HEADROOM_UDENOM + ALLOWANCE_ABOVE_HEADROOM_BELOW_A_COOLDOWN;

      await createDeploymentSetting(user.id, drainingDseq);

      mockLeasesForOwner(address, [createActiveLease(address, drainingDseq)]);
      mockDeploymentsForOwner(address, [createActiveDeployment(address, drainingDseq, NEARLY_DRAINED_ESCROW_AMOUNT)]);
      stubGetFreshLimits({ [address]: available });

      await topUpService.topUpDeployments({ dryRun: false });

      const [deposited] = depositedAmounts(executeDerivedTx);
      expect(executeDerivedTx).toHaveBeenCalledOnce();
      expect(deposited).toBeGreaterThan(ALLOWANCE_ABOVE_HEADROOM_BELOW_A_COOLDOWN);
      expect(deposited).toBeLessThanOrEqual(available);
    });

    it("funds a draining deployment from the whole balance when it sits below the headroom floor", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, address } = await createUserWithWallet();
      const drainingDseq = "900002";

      await createDeploymentSetting(user.id, drainingDseq);

      mockLeasesForOwner(address, [createActiveLease(address, drainingDseq)]);
      mockDeploymentsForOwner(address, [createActiveDeployment(address, drainingDseq)]);
      stubGetFreshLimits({ [address]: 1000000 });

      await topUpService.topUpDeployments({ dryRun: false });

      expect(executeDerivedTx).toHaveBeenCalledOnce();
      expect(depositedAmounts(executeDerivedTx)).toEqual([1000000]);
    });
  });

  describe("topUpDrainingDeploymentsForOwner", () => {
    it("funds each draining deployment at most once when two passes for the same wallet run at once", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, wallet, address } = await createUserWithWallet();
      const dseqA = "800001";
      const dseqB = "800002";

      await createDeploymentSetting(user.id, dseqA);
      await createDeploymentSetting(user.id, dseqB);

      mockLeasesForOwner(address, [createActiveLease(address, dseqA), createActiveLease(address, dseqB)], { persist: true });
      mockDeploymentsForOwner(address, [createActiveDeployment(address, dseqA), createActiveDeployment(address, dseqB)], { persist: true });
      stubGetFreshLimits({ [address]: 10000000 });

      await Promise.all([
        topUpService.topUpDrainingDeploymentsForOwner({ walletId: wallet.id, address }),
        topUpService.topUpDrainingDeploymentsForOwner({ walletId: wallet.id, address })
      ]);

      const depositedXids = executeDerivedTx.mock.calls.flatMap(([, messages]) => messages.map(message => message.value.id.xid as string));
      expect(depositedXids.filter(xid => xid.includes(`/${dseqA}`))).toHaveLength(1);
      expect(depositedXids.filter(xid => xid.includes(`/${dseqB}`))).toHaveLength(1);
    });

    it("does not fund again when a later pass arrives within the cooldown of a successful funding", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, wallet, address } = await createUserWithWallet();
      const dseq = "810001";

      await createDeploymentSetting(user.id, dseq);
      mockLeasesForOwner(address, [createActiveLease(address, dseq)], { persist: true });
      mockDeploymentsForOwner(address, [createActiveDeployment(address, dseq)], { persist: true });
      stubGetFreshLimits({ [address]: 10000000 });

      await topUpService.topUpDrainingDeploymentsForOwner({ walletId: wallet.id, address });
      await topUpService.topUpDrainingDeploymentsForOwner({ walletId: wallet.id, address });

      expect(executeDerivedTx).toHaveBeenCalledOnce();
    });

    it("declines a dust deposit the allowance caps below the cooldown, then funds in full once credits arrive", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, wallet, address } = await createUserWithWallet();
      const dseq = "830001";
      /** Buys 40 minutes at the seeded block rate, short of the 60-minute dedup cooldown. */
      const DUST_ALLOWANCE = 20000;

      await createDeploymentSetting(user.id, dseq);
      mockLeasesForOwner(address, [createActiveLease(address, dseq)], { persist: true });
      mockDeploymentsForOwner(address, [createActiveDeployment(address, dseq)], { persist: true });

      stubGetFreshLimits({ [address]: DUST_ALLOWANCE });
      await topUpService.topUpDrainingDeploymentsForOwner({ walletId: wallet.id, address });

      expect(executeDerivedTx).not.toHaveBeenCalled();

      stubGetFreshLimits({ [address]: 10000000 });
      await topUpService.topUpDrainingDeploymentsForOwner({ walletId: wallet.id, address });

      expect(executeDerivedTx).toHaveBeenCalledOnce();
      expect(depositedAmounts(executeDerivedTx)).toEqual([BLOCK_RATE * averageBlockCountInAnHour * 48]);
    });

    it("releases the claim of a deposit that landed with a non-OK code so the next pass funds it", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, wallet, address } = await createUserWithWallet();
      const dseq = "820001";

      await createDeploymentSetting(user.id, dseq);
      mockLeasesForOwner(address, [createActiveLease(address, dseq)], { persist: true });
      mockDeploymentsForOwner(address, [createActiveDeployment(address, dseq)], { persist: true });
      stubGetFreshLimits({ [address]: 10000000 });

      executeDerivedTx.mockResolvedValueOnce({ code: 11, hash: "FAILHASH", rawLog: "out of gas" });

      await topUpService.topUpDrainingDeploymentsForOwner({ walletId: wallet.id, address });
      await topUpService.topUpDrainingDeploymentsForOwner({ walletId: wallet.id, address });

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
    });
  });

  function createActiveLease(owner: string, dseq: string) {
    return createLeaseApiResponse({
      owner,
      dseq,
      state: "active",
      price: { denom: DENOM, amount: String(BLOCK_RATE) }
    });
  }

  function createClosedLease(owner: string, dseq: string) {
    return createLeaseApiResponse({
      owner,
      dseq,
      state: "closed",
      price: { denom: DENOM, amount: String(BLOCK_RATE) },
      closed_on: CLOSED_HEIGHT
    });
  }

  function createActiveDeployment(owner: string, dseq: string, escrowAmount = ESCROW_AMOUNT) {
    return createDeploymentInfoSeed({
      owner,
      dseq,
      state: "active",
      amount: escrowAmount,
      denom: DENOM,
      createdAt: String(CURRENT_HEIGHT - 1000)
    });
  }

  function createClosedDeployment(owner: string, dseq: string) {
    return createDeploymentInfoSeed({
      owner,
      dseq,
      state: "closed",
      amount: ESCROW_AMOUNT,
      denom: DENOM,
      createdAt: String(CURRENT_HEIGHT - 1000)
    });
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userWalletsTable = resolveTable("UserWallets");
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const userRepository = container.resolve(UserRepository);
    const apiNodeUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;
    const topUpService = container.resolve(TopUpManagedDeploymentsService);
    const signerService = container.resolve(ManagedSignerService);
    const balances = container.resolve(BalancesService);
    const chainErrorService = container.resolve(ChainErrorService);

    nock(apiNodeUrl)
      .get("/cosmos/base/tendermint/v1beta1/blocks/latest")
      .reply(200, { block: { header: { height: String(CURRENT_HEIGHT) } } })
      .persist();

    const executeDerivedTx = vi.spyOn(signerService, "executeDerivedTx").mockResolvedValue({
      code: 0,
      hash: "TESTHASH",
      rawLog: "[]"
    });

    async function createUserWithWallet(input?: { address?: string; deploymentAllowance?: string }) {
      const address = input?.address ?? createAkashAddress();
      const user = await userRepository.create({});
      const [wallet] = await db
        .insert(userWalletsTable)
        .values({
          userId: user.id,
          address,
          deploymentAllowance: input?.deploymentAllowance ?? "10000000",
          feeAllowance: "5000000",
          isTrialing: false
        })
        .returning();

      return { user, wallet, address };
    }

    async function createDeploymentSetting(
      userId: string,
      dseq: string,
      overrides?: { autoTopUpEnabled?: boolean; closed?: boolean; runtimeLimitHours?: number; runtimeEndsAt?: Date }
    ) {
      const [setting] = await db
        .insert(deploymentSettingsTable)
        .values({
          userId,
          dseq,
          autoTopUpEnabled: overrides?.autoTopUpEnabled ?? true,
          closed: overrides?.closed ?? false,
          runtimeLimitHours: overrides?.runtimeLimitHours ?? null,
          runtimeEndsAt: overrides?.runtimeEndsAt ?? null
        })
        .returning();

      return setting;
    }

    async function findSetting(address: string, dseq: string) {
      const wallet = await container.resolve(UserWalletRepository).findOneBy({ address });
      if (!wallet) return undefined;

      const results = await db
        .select()
        .from(deploymentSettingsTable)
        .where(and(eq(deploymentSettingsTable.dseq, dseq), eq(deploymentSettingsTable.userId, wallet.userId)));

      return results[0];
    }

    function mockLeasesForOwner(owner: string, leases: ReturnType<typeof createLeaseApiResponse>[], options?: { persist?: boolean }) {
      const scope = nock(apiNodeUrl);
      if (options?.persist) scope.persist();
      scope
        .get("/akash/market/v1beta5/leases/list")
        .query(query => query["filters.owner"] === owner)
        .reply(200, { leases, pagination: { next_key: null, total: String(leases.length) } });
    }

    function mockDeploymentsForOwner(owner: string, deployments: ReturnType<typeof createDeploymentInfoSeed>[], options?: { persist?: boolean }) {
      const scope = nock(apiNodeUrl);
      if (options?.persist) scope.persist();
      scope
        .get("/akash/deployment/v1beta4/deployments/list")
        .query(query => String(query["filters.owner"]) === owner)
        .reply(200, { deployments, pagination: { next_key: null, total: String(deployments.length) } });
    }

    function stubGetFreshLimits(balanceByAddress: Record<string, number>) {
      vi.spyOn(balances, "getFreshLimits").mockImplementation(async (wallet: { address: string | null }) => ({
        fee: 5000000,
        deployment: balanceByAddress[wallet.address!] ?? 0
      }));
      vi.spyOn(balances, "retrieveDeploymentLimit").mockImplementation(async (wallet: { address: string | null }) => balanceByAddress[wallet.address!] ?? 0);
      vi.spyOn(balances, "retrieveAndCalcFeeLimit").mockResolvedValue(5000000);
    }

    return {
      topUpService,
      executeDerivedTx,
      chainErrorService,
      createUserWithWallet,
      createDeploymentSetting,
      findSetting,
      mockLeasesForOwner,
      mockDeploymentsForOwner,
      stubGetFreshLimits
    };
  }
});
