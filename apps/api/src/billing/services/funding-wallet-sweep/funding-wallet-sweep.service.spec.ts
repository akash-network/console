import { MsgSend } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { BalanceHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentAllowanceHistoryRepository } from "@src/billing/repositories/deployment-allowance-history/deployment-allowance-history.repository";
import type { FundingWalletRepository, FundingWalletStatus } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { FundingWalletMoveRepository } from "@src/billing/repositories/funding-wallet-move/funding-wallet-move.repository";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { CreateLogger } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { FundingWalletSweepService } from "./funding-wallet-sweep.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const NETWORK = "sandbox";

describe(FundingWalletSweepService.name, () => {
  describe("sweep", () => {
    it("sends everything a retired wallet holds to the active one, keeping 1 AKT back for the fees of later sweeps", async () => {
      const { service, retired, active, txManagerService, fundingWalletRepository, balanceHttpService, logger } = setup({
        balances: { uact: 2_500_000_000, uakt: 40_000_000 }
      });

      const sweep = await service.sweep(retired.address);

      expect(sweep).toEqual({
        from: retired.address,
        to: active.address,
        swept: [
          { denom: "uact", amount: "2500000000" },
          { denom: "uakt", amount: "39000000" }
        ],
        txHash: "SWEEP-HASH",
        deploymentsStillFunded: 0
      });
      expect(fundingWalletRepository.findByAddress).toHaveBeenCalledWith(NETWORK, retired.address);
      expect(fundingWalletRepository.findActive).toHaveBeenCalledWith(NETWORK);
      expect(balanceHttpService.getBalance.mock.calls).toEqual([
        [retired.address, "uact"],
        [retired.address, "uakt"]
      ]);
      expect(txManagerService.signAndBroadcastWithFundingWallet).toHaveBeenCalledTimes(1);
      expect(txManagerService.signAndBroadcastWithFundingWallet).toHaveBeenCalledWith([
        {
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: MsgSend.fromPartial({ fromAddress: retired.address, toAddress: active.address, amount: sweep.swept })
        }
      ]);
      expect(logger.info).toHaveBeenCalledWith({ event: "FUNDING_WALLET_SWEPT", ...sweep });
    });

    it("sends the escrow that returned and none of the AKT when the wallet holds no more AKT than it keeps for fees", async () => {
      const { service, retired, txManagerService } = setup({ balances: { uact: 700_000, uakt: 1_000_000 } });

      const sweep = await service.sweep(retired.address);

      expect(sweep.swept).toEqual([{ denom: "uact", amount: "700000" }]);
      expect(txManagerService.signAndBroadcastWithFundingWallet).toHaveBeenCalledTimes(1);
    });

    it("sends the one uakt above what it keeps for fees", async () => {
      const { service, retired } = setup({ balances: { uakt: 1_000_001 } });

      await expect(service.sweep(retired.address)).resolves.toMatchObject({ swept: [{ denom: "uakt", amount: "1" }] });
    });

    it("sends nothing and says so when the wallet holds only what it keeps for fees", async () => {
      const { service, retired, active, txManagerService, logger } = setup({ balances: { uakt: 900_000 } });

      const sweep = await service.sweep(retired.address);

      expect(sweep).toEqual({ from: retired.address, to: active.address, swept: [], deploymentsStillFunded: 0 });
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith({ event: "FUNDING_WALLET_SWEEP_NOTHING_TO_SEND", ...sweep });
    });

    it("reports how many deployments the moved users opened while the wallet's grant stood and still run, asked 500 users at a time", async () => {
      const moved = Array.from({ length: 501 }, (_, index) => ({ owner: createAkashAddress(), readHeight: 1_000 + index, revokeTxHash: null }));
      const { service, retired, fundingWalletMoveRepository, deploymentRepository } = setup({ moved, openDeploymentsPerPage: [7, 2] });

      await expect(service.sweep(retired.address)).resolves.toMatchObject({ deploymentsStillFunded: 9 });

      expect(fundingWalletMoveRepository.findCompletedReads).toHaveBeenCalledWith(retired.id);
      expect(deploymentRepository.countOpenCreatedAtOrBefore.mock.calls).toEqual(
        [moved.slice(0, 500), moved.slice(500)].map(page => [page.map(({ owner, readHeight }) => ({ owner, height: readHeight }))])
      );
    });

    it("counts a user's deployments up to the height their revoke landed at, and up to their balance read when there was no revoke or the index lacks it", async () => {
      const [revoked, revokedNothing, revokeNotIndexed] = [1, 2, 3].map(() => createAkashAddress());
      const { service, retired, deploymentRepository, deploymentAllowanceHistoryRepository } = setup({
        moved: [
          { owner: revoked, readHeight: 1_000, revokeTxHash: "REVOKE-A" },
          { owner: revokedNothing, readHeight: 2_000, revokeTxHash: null },
          { owner: revokeNotIndexed, readHeight: 3_000, revokeTxHash: "REVOKE-C" }
        ],
        revokeHeights: { "REVOKE-A": 1_012 },
        openDeploymentsPerPage: [1]
      });

      await expect(service.sweep(retired.address)).resolves.toMatchObject({ deploymentsStillFunded: 1 });

      expect(deploymentAllowanceHistoryRepository.findTxHeights).toHaveBeenCalledWith(["REVOKE-A", "REVOKE-C"]);
      expect(deploymentRepository.countOpenCreatedAtOrBefore).toHaveBeenCalledWith([
        { owner: revoked, height: 1_012 },
        { owner: revokedNothing, height: 2_000 },
        { owner: revokeNotIndexed, height: 3_000 }
      ]);
    });

    it.each(["standby", "active", "draining"] as const)("refuses a %s wallet, whose coins are still needed where they are", async status => {
      const { service, retired, txManagerService, balanceHttpService } = setup({ status });

      await expect(service.sweep(retired.address)).rejects.toMatchObject({
        status: 409,
        message: `Funding wallet ${retired.address} is ${status}, and only a retired one is swept`,
        network: NETWORK
      });

      expect(balanceHttpService.getBalance).not.toHaveBeenCalled();
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("refuses a wallet that is not registered", async () => {
      const { service, txManagerService } = setup({ isRegistered: false });
      const address = createAkashAddress();

      await expect(service.sweep(address)).rejects.toMatchObject({ status: 404, message: `Funding wallet ${address} is not registered`, network: NETWORK });

      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("refuses when no wallet is active to receive the coins", async () => {
      const { service, retired, txManagerService } = setup({ hasActive: false });

      await expect(service.sweep(retired.address)).rejects.toMatchObject({
        status: 409,
        message: "No funding wallet is active to receive the coins",
        network: NETWORK
      });

      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("fails with the chain's log when the send lands with a failure code", async () => {
      const { service, retired, logger } = setup({ balances: { uact: 500_000 }, tx: { code: 5, hash: "FAILED-HASH", rawLog: "insufficient funds" } });

      await expect(service.sweep(retired.address)).rejects.toMatchObject({
        status: 502,
        message: `The sweep of funding wallet ${retired.address} landed with code 5`,
        txHash: "FAILED-HASH",
        rawLog: "insufficient funds"
      });

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  it("names itself as the context of its logs", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: FundingWalletSweepService.name });
  });

  function setup(
    input: {
      status?: FundingWalletStatus;
      isRegistered?: boolean;
      hasActive?: boolean;
      balances?: { uact?: number; uakt?: number };
      moved?: { owner: string; readHeight: number; revokeTxHash: string | null }[];
      revokeHeights?: Record<string, number>;
      openDeploymentsPerPage?: number[];
      tx?: { code: number; hash: string; rawLog: string };
    } = {}
  ) {
    const retired = { id: crypto.randomUUID(), network: NETWORK, address: createAkashAddress(), status: input.status ?? ("retired" as const) };
    const active = { id: crypto.randomUUID(), network: NETWORK, address: createAkashAddress(), status: "active" as const };

    const fundingWalletRepository = mock<FundingWalletRepository>();
    const fundingWalletMoveRepository = mock<FundingWalletMoveRepository>();
    const deploymentRepository = mock<DeploymentRepository>();
    const deploymentAllowanceHistoryRepository = mock<DeploymentAllowanceHistoryRepository>();
    const balanceHttpService = mock<BalanceHttpService>();
    const txManagerService = mock<TxManagerService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    fundingWalletRepository.findByAddress.mockResolvedValue(input.isRegistered === false ? undefined : retired);
    fundingWalletRepository.findActive.mockResolvedValue(input.hasActive === false ? undefined : active);
    fundingWalletMoveRepository.findCompletedReads.mockResolvedValue(input.moved ?? []);
    deploymentAllowanceHistoryRepository.findTxHeights.mockResolvedValue(new Map(Object.entries(input.revokeHeights ?? {})));
    (input.openDeploymentsPerPage ?? []).forEach(count => deploymentRepository.countOpenCreatedAtOrBefore.mockResolvedValueOnce(count));
    balanceHttpService.getBalance.mockImplementation(async (_address, denom) => {
      const amount = input.balances?.[denom as "uact" | "uakt"];

      return amount === undefined ? undefined : { denom: denom as "uact" | "uakt", amount };
    });
    txManagerService.signAndBroadcastWithFundingWallet.mockResolvedValue(
      mock<Awaited<ReturnType<TxManagerService["signAndBroadcastWithFundingWallet"]>>>(input.tx ?? { code: 0, hash: "SWEEP-HASH", rawLog: "" })
    );

    const service = new FundingWalletSweepService(
      fundingWalletRepository,
      fundingWalletMoveRepository,
      deploymentRepository,
      deploymentAllowanceHistoryRepository,
      balanceHttpService,
      txManagerService,
      mockConfigService<CoreConfigService>({ NETWORK }),
      createLogger
    );

    return {
      service,
      retired,
      active,
      fundingWalletRepository,
      fundingWalletMoveRepository,
      deploymentRepository,
      deploymentAllowanceHistoryRepository,
      balanceHttpService,
      txManagerService,
      logger,
      createLogger
    };
  }
});
