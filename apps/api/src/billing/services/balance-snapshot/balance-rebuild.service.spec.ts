import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BalanceSnapshotOutput, BalanceSnapshotRepository } from "@src/billing/repositories/balance-snapshot/balance-snapshot.repository";
import type {
  AllowanceChange,
  DeploymentAllowanceHistoryRepository
} from "@src/billing/repositories/deployment-allowance-history/deployment-allowance-history.repository";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { CreateLogger } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { BalanceRebuildService } from "./balance-rebuild.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const NETWORK = "sandbox";
const DENOM = "uact";
const SNAPSHOT_HEIGHT = 25_000_000;
const CURRENT_HEIGHT = 25_014_400;
const ON_CHAIN_READ_HEIGHT = CURRENT_HEIGHT + 2;

describe(BalanceRebuildService.name, () => {
  describe("rebuild", () => {
    it("replays what the chain index shows of the grant since the latest complete snapshot, up to the current height", async () => {
      const { service, user, granter, snapshot, balanceSnapshotRepository, deploymentAllowanceHistoryRepository, balancesService, fundingWalletRegistry } =
        setup({
          inSnapshot: 1_000_000,
          changes: [deposit(300_000), refund(100_000)],
          onChain: 800_000
        });

      await expect(service.rebuild(user)).resolves.toEqual({
        address: user,
        takenOn: "2026-11-27",
        height: SNAPSHOT_HEIGHT,
        rebuiltUpTo: CURRENT_HEIGHT,
        balances: [{ granter, inSnapshot: 1_000_000, rebuilt: 800_000, onChain: 800_000, onChainHeight: ON_CHAIN_READ_HEIGHT }]
      });

      expect(balanceSnapshotRepository.findLatestComplete).toHaveBeenCalledWith(NETWORK);
      expect(balanceSnapshotRepository.findByDay).not.toHaveBeenCalled();
      expect(balanceSnapshotRepository.findGrantsOf).toHaveBeenCalledWith(snapshot.id, user);
      expect(fundingWalletRegistry.getGranterAddressByWalletAddress).toHaveBeenCalledWith(user);
      expect(deploymentAllowanceHistoryRepository.findChanges).toHaveBeenCalledWith({
        granter,
        grantee: user,
        msgTypeUrl: "/akash.escrow.v1.MsgAccountDeposit",
        afterHeight: SNAPSHOT_HEIGHT,
        before: { height: CURRENT_HEIGHT + 1, txIndex: 0 }
      });
      expect(balancesService.retrieveDeploymentLimitAtLatestHeight).toHaveBeenCalledWith({ address: user }, { granter });
    });

    it("logs the rebuilt balance, which is all a command run shows of it", async () => {
      const { service, user, logger, createLogger } = setup({ inSnapshot: 1_000_000, changes: [deposit(300_000)], onChain: 650_000 });

      const rebuilt = await service.rebuild(user);

      expect(createLogger).toHaveBeenCalledWith({ context: BalanceRebuildService.name });
      expect(logger.info).toHaveBeenCalledExactlyOnceWith({ event: "BALANCE_REBUILT", ...rebuilt });
      expect(rebuilt.balances).toEqual([expect.objectContaining({ inSnapshot: 1_000_000, rebuilt: 700_000, onChain: 650_000 })]);
    });

    it("logs nothing when there is no snapshot to rebuild from", async () => {
      const { service, user, logger } = setup({ hasSnapshot: false });

      await expect(service.rebuild(user)).rejects.toMatchObject({ status: 404 });

      expect(logger.info).not.toHaveBeenCalled();
    });

    it("starts from the snapshot of the day asked for", async () => {
      const { service, user, balanceSnapshotRepository } = setup({ inSnapshot: 5 });

      await expect(service.rebuild(user, "2026-11-27")).resolves.toMatchObject({ takenOn: "2026-11-27" });

      expect(balanceSnapshotRepository.findByDay).toHaveBeenCalledWith({ network: NETWORK, takenOn: "2026-11-27" });
      expect(balanceSnapshotRepository.findLatestComplete).not.toHaveBeenCalled();
    });

    it("counts only the denom balances are kept in", async () => {
      const { service, user, granter } = setup({ inSnapshot: 1_000_000, otherDenomInSnapshot: 77, changes: [], onChain: 1_000_000 });

      await expect(service.rebuild(user)).resolves.toMatchObject({ balances: [{ granter, inSnapshot: 1_000_000, rebuilt: 1_000_000, onChain: 1_000_000 }] });
    });

    it("rebuilds from nothing on the user's current funding wallet when the snapshot holds no grant from it", async () => {
      const movedTo = createAkashAddress();
      const { service, user, granter } = setup({ inSnapshot: 1_000_000, currentGranter: movedTo });

      const rebuilt = await service.rebuild(user);

      expect(rebuilt.balances).toEqual([
        { granter, inSnapshot: 1_000_000, rebuilt: 1_000_000, onChain: 0, onChainHeight: ON_CHAIN_READ_HEIGHT },
        { granter: movedTo, inSnapshot: 0, rebuilt: 0, onChain: 0, onChainHeight: ON_CHAIN_READ_HEIGHT }
      ]);
    });

    it("keeps a zero balance the snapshot holds from the current funding wallet as one entry", async () => {
      const { service, user, granter } = setup({ inSnapshot: 0 });

      await expect(service.rebuild(user)).resolves.toMatchObject({ balances: [{ granter, inSnapshot: 0, rebuilt: 0, onChain: 0 }] });
    });

    it.each(["running", "failed"] as const)("refuses the day asked for when its snapshot is %s", async status => {
      const { service, user, deploymentAllowanceHistoryRepository } = setup({ status });

      await expect(service.rebuild(user, "2026-11-27")).rejects.toMatchObject({
        status: 404,
        message: "No complete balance snapshot was taken on 2026-11-27",
        network: NETWORK
      });

      expect(deploymentAllowanceHistoryRepository.findChanges).not.toHaveBeenCalled();
    });

    it("refuses when no snapshot was ever completed", async () => {
      const { service, user } = setup({ hasSnapshot: false });

      await expect(service.rebuild(user)).rejects.toMatchObject({ status: 404, message: "No complete balance snapshot was taken yet", network: NETWORK });
      await expect(service.rebuild(user, "2026-11-27")).rejects.toMatchObject({ status: 404, message: "No complete balance snapshot was taken on 2026-11-27" });
    });
  });

  function deposit(amount: number): AllowanceChange {
    return mock<AllowanceChange>({ type: "/akash.escrow.v1.MsgAccountDeposit", spentByGranter: [`${amount}${DENOM}`], receivedByGranter: [] });
  }

  function refund(amount: number): AllowanceChange {
    return mock<AllowanceChange>({ type: "/akash.deployment.v1beta4.MsgCloseDeployment", spentByGranter: [], receivedByGranter: [`${amount}${DENOM}`] });
  }

  function setup(
    input: {
      inSnapshot?: number;
      otherDenomInSnapshot?: number;
      changes?: AllowanceChange[];
      onChain?: number;
      currentGranter?: string;
      status?: BalanceSnapshotOutput["status"];
      hasSnapshot?: boolean;
    } = {}
  ) {
    const user = createAkashAddress();
    const granter = createAkashAddress();
    const snapshot = mock<BalanceSnapshotOutput>({
      id: crypto.randomUUID(),
      network: NETWORK,
      takenOn: "2026-11-27",
      height: SNAPSHOT_HEIGHT,
      status: input.status ?? "complete"
    });

    const balanceSnapshotRepository = mock<BalanceSnapshotRepository>();
    const deploymentAllowanceHistoryRepository = mock<DeploymentAllowanceHistoryRepository>();
    const balancesService = mock<BalancesService>();
    const fundingWalletRegistry = mock<FundingWalletRegistryService>();
    const blockHttpService = mock<BlockHttpService>();

    balanceSnapshotRepository.findLatestComplete.mockResolvedValue(input.hasSnapshot === false ? undefined : snapshot);
    balanceSnapshotRepository.findByDay.mockResolvedValue(input.hasSnapshot === false ? undefined : snapshot);
    balanceSnapshotRepository.findGrantsOf.mockResolvedValue([
      ...(input.inSnapshot === undefined ? [] : [{ granter, grantee: user, denom: DENOM, amount: input.inSnapshot }]),
      ...(input.otherDenomInSnapshot === undefined ? [] : [{ granter, grantee: user, denom: "uother", amount: input.otherDenomInSnapshot }])
    ]);
    fundingWalletRegistry.getGranterAddressByWalletAddress.mockResolvedValue(input.currentGranter ?? granter);
    blockHttpService.getFreshCurrentHeight.mockResolvedValue(CURRENT_HEIGHT);
    deploymentAllowanceHistoryRepository.findChanges.mockImplementation(async query => (query.granter === granter ? input.changes ?? [] : []));
    balancesService.retrieveDeploymentLimitAtLatestHeight.mockImplementation(async (_wallet, options) => ({
      limit: options?.granter === granter ? input.onChain ?? 0 : 0,
      height: ON_CHAIN_READ_HEIGHT,
      granter: options!.granter!
    }));
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new BalanceRebuildService(
      balanceSnapshotRepository,
      deploymentAllowanceHistoryRepository,
      balancesService,
      fundingWalletRegistry,
      blockHttpService,
      mockConfigService<BillingConfigService>({ DEPLOYMENT_GRANT_DENOM: DENOM }),
      mockConfigService<CoreConfigService>({ NETWORK }),
      createLogger
    );

    return {
      service,
      user,
      granter,
      snapshot,
      balanceSnapshotRepository,
      deploymentAllowanceHistoryRepository,
      balancesService,
      fundingWalletRegistry,
      logger,
      createLogger
    };
  }
});
