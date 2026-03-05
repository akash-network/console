import { and, eq } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { ApiPgDatabase } from "@src/core";
import { CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { TopUpManagedDeploymentsService } from "./top-up-managed-deployments.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { DeploymentInfoSeeder } from "@test/seeders/deployment-info.seeder";
import { LeaseApiResponseSeeder } from "@test/seeders/lease-api-response.seeder";

const CURRENT_HEIGHT = 1000000;
const CLOSED_HEIGHT = String(CURRENT_HEIGHT - 500);
const DENOM = "uakt";
const BLOCK_RATE = 50;
const ESCROW_AMOUNT = "50000";

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
        DeploymentInfoSeeder.create({
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
    // The CachedBalance.reserveSufficientAmount call throws "Insufficient balance",
    // which the job catches and counts but does not propagate.
    // No transactions should be submitted, and the job should still return Ok.
    it("handles insufficient user balance by skipping the deployment", async () => {
      const { topUpService, executeDerivedTx, createUserWithWallet, createDeploymentSetting, mockLeasesForOwner, mockDeploymentsForOwner, stubGetFreshLimits } =
        await setup();
      const { user, address } = await createUserWithWallet();
      const drainingDseq = "700001";

      await createDeploymentSetting(user.id, drainingDseq);

      mockLeasesForOwner(address, [createActiveLease(address, drainingDseq)]);
      mockDeploymentsForOwner(address, [createActiveDeployment(address, drainingDseq)]);
      stubGetFreshLimits({ [address]: 0 });

      const result = await topUpService.topUpDeployments({ dryRun: false });

      expect(result.ok).toBe(true);
      expect(executeDerivedTx).not.toHaveBeenCalled();
    });
  });

  function createActiveLease(owner: string, dseq: string) {
    return LeaseApiResponseSeeder.create({
      owner,
      dseq,
      state: "active",
      price: { denom: DENOM, amount: String(BLOCK_RATE) }
    });
  }

  function createClosedLease(owner: string, dseq: string) {
    return LeaseApiResponseSeeder.create({
      owner,
      dseq,
      state: "closed",
      price: { denom: DENOM, amount: String(BLOCK_RATE) },
      closed_on: CLOSED_HEIGHT
    });
  }

  function createActiveDeployment(owner: string, dseq: string) {
    return DeploymentInfoSeeder.create({
      owner,
      dseq,
      state: "active",
      amount: ESCROW_AMOUNT,
      denom: DENOM,
      createdAt: String(CURRENT_HEIGHT - 1000)
    });
  }

  function createClosedDeployment(owner: string, dseq: string) {
    return DeploymentInfoSeeder.create({
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

    async function createDeploymentSetting(userId: string, dseq: string, overrides?: { autoTopUpEnabled?: boolean; closed?: boolean }) {
      const [setting] = await db
        .insert(deploymentSettingsTable)
        .values({
          userId,
          dseq,
          autoTopUpEnabled: overrides?.autoTopUpEnabled ?? true,
          closed: overrides?.closed ?? false
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

    function mockLeasesForOwner(owner: string, leases: ReturnType<typeof LeaseApiResponseSeeder.create>[]) {
      nock(apiNodeUrl)
        .get("/akash/market/v1beta5/leases/list")
        .query(query => query["filters.owner"] === owner)
        .reply(200, { leases, pagination: { next_key: null, total: String(leases.length) } });
    }

    function mockDeploymentsForOwner(owner: string, deployments: ReturnType<typeof DeploymentInfoSeeder.create>[]) {
      nock(apiNodeUrl)
        .get("/akash/deployment/v1beta4/deployments/list")
        .query(query => String(query["filters.owner"]) === owner)
        .reply(200, { deployments, pagination: { next_key: null, total: String(deployments.length) } });
    }

    function stubGetFreshLimits(balanceByAddress: Record<string, number>) {
      vi.spyOn(balances, "getFreshLimits").mockImplementation(async (wallet: { address: string | null }) => ({
        fee: 5000000,
        deployment: balanceByAddress[wallet.address!] ?? 0
      }));
    }

    return {
      topUpService,
      executeDerivedTx,
      createUserWithWallet,
      createDeploymentSetting,
      findSetting,
      mockLeasesForOwner,
      mockDeploymentsForOwner,
      stubGetFreshLimits
    };
  }
});
