import type { BalanceHttpService } from "@akashnetwork/http-sdk";
import type { IndexedTx } from "@cosmjs/stargate";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { ManagedWalletRef, UserWalletRepository } from "@src/billing/repositories";
import type { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { BlockRepository } from "@src/chain/repositories/block.repository";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ErrorService } from "@src/core/services/error/error.service";
import type { DeploymentRepository, StaleDeployment } from "@src/deployment/repositories/deployment/deployment.repository";
import { StaleManagedDeploymentsCleanerService } from "./stale-managed-deployments-cleaner.service";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const UNSETTLEABLE_PANIC = "Query failed with (6): rpc error: code = Unknown desc = recovered: negative decimal coin amount: -2.000000000000000000";
const OWNER = "akash1test";
const UNSETTLEABLE_LOG = {
  event: "DEPLOYMENT_CLEAN_UP_UNSETTLEABLE",
  reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
  owner: OWNER
};

const FEE_GRANT_REFUSED =
  "Broadcasting transaction failed with code 38 (codespace: sdk). Log: akash1master does not allow to pay fees for akash1test: fee-grant not found: not found";

describe(StaleManagedDeploymentsCleanerService.name, () => {
  describe("cleanUpForWallet", () => {
    it("cuts off well below the current height when no age override is passed", async () => {
      const { service, deploymentRepository, wallet } = setup({ currentHeight: 1_000_000 });

      await service.cleanUpForWallet(wallet);

      const cutoff = deploymentRepository.findStaleDeployments.mock.calls[0][0].staleBeforeHeight;
      expect(cutoff).toBeLessThan(1_000_000);
    });

    it("uses the current height as the cutoff when age 0 is passed so every lease-less deployment is stale", async () => {
      const { service, deploymentRepository, wallet } = setup({ currentHeight: 1_000_000 });

      await service.cleanUpForWallet(wallet, 0);

      expect(deploymentRepository.findStaleDeployments).toHaveBeenCalledWith({ owners: [wallet.address], staleBeforeHeight: 1_000_000 });
    });

    it("reads the chain height itself when called for a single wallet", async () => {
      const { service, blockRepository, wallet } = setup();

      await service.cleanUpForWallet(wallet, 0);

      expect(blockRepository.getLatestProcessedHeight).toHaveBeenCalledTimes(1);
    });

    it("does not broadcast when there are no stale deployments", async () => {
      const { service, managedSignerService, wallet } = setup({ staleDeployments: [] });

      await service.cleanUpForWallet(wallet, 0);

      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("closes all stale deployments in a single derived tx", async () => {
      const closeMsg = { typeUrl: "/close", value: {} };
      const { service, managedSignerService, rpcMessageService, wallet } = setup({ staleDeployments: ["1", "2"] });
      rpcMessageService.getCloseDeploymentMsg.mockReturnValue(closeMsg as never);

      await service.cleanUpForWallet(wallet, 0);

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(wallet.id, [closeMsg, closeMsg]);
    });

    it("splits a wallet's orphans across transactions so one close batch cannot outgrow a block", async () => {
      const dseqs = Array.from({ length: 45 }, (_, index) => String(index + 1));
      const { service, managedSignerService, wallet } = setup({ staleDeployments: dseqs });

      await service.cleanUpForWallet(wallet, 0);

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(3);
      expect(managedSignerService.executeDerivedTx.mock.calls.map(([, messages]) => messages.length)).toEqual([20, 20, 5]);
    });
  });

  describe("when a deployment is already closed on chain", () => {
    it("drops the closed deployment and closes the rest in a second broadcast", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(buildDeploymentClosedAppError(1)).mockResolvedValueOnce(buildOkTx());
      const { service, logger, wallet } = setup({ staleDeployments: ["1", "2", "3"], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(executeDerivedTx).toHaveBeenLastCalledWith(wallet.id, [
        expect.objectContaining({ value: expect.objectContaining({ dseq: "1" }) }),
        expect.objectContaining({ value: expect.objectContaining({ dseq: "3" }) })
      ]);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: OWNER, dseq: "2" });
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: OWNER, alreadyClosedCount: 1 });
    });

    it("resolves quietly when the wallet's only orphan is already closed and the error carries no index", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(buildDeploymentClosedAppError());
      const { service, logger, errorLogger, wallet } = setup({ staleDeployments: ["7"], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: OWNER, dseq: "7" });
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: OWNER, alreadyClosedCount: 1 });
      expect(logger.error).not.toHaveBeenCalled();
      expect(errorLogger.error).not.toHaveBeenCalled();
    });

    it("reports success without an error when the whole batch is already closed", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValue(buildDeploymentClosedAppError(0));
      const { service, logger, errorLogger, wallet } = setup({ staleDeployments: ["1", "2"], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: OWNER, alreadyClosedCount: 2 });
      expect(logger.error).not.toHaveBeenCalled();
      expect(errorLogger.error).not.toHaveBeenCalled();
    });

    it("rethrows into the wallet error handler when the reported index falls outside the batch", async () => {
      const error = buildDeploymentClosedAppError(7);
      const { service, managedSignerService, logger, errorLogger } = setup({
        staleDeployments: ["1", "2"],
        executeDerivedTx: vi.fn().mockRejectedValue(error)
      });

      const result = await service.cleanup({ concurrency: 1, dryRun: false });

      expect(result.ok).toBe(true);
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED" }));
      expect(errorLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_ERROR", error }));
    });

    it("stops after the drop limit without reporting an error when too many deployments turn out closed", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValue(buildDeploymentClosedAppError(0));
      const { service, logger, errorLogger, wallet } = setup({
        staleDeployments: ["1", "2", "3", "4", "5"],
        executeDerivedTx
      });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(4);
      expect(logger.warn).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_DROP_LIMIT", owner: OWNER, remainingCount: 2 });
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS" }));
      expect(logger.error).not.toHaveBeenCalled();
      expect(errorLogger.error).not.toHaveBeenCalled();
    });

    it("still closes the survivors when the drop limit is reached on the last closed deployment", async () => {
      const executeDerivedTx = vi
        .fn()
        .mockRejectedValueOnce(buildDeploymentClosedAppError(0))
        .mockRejectedValueOnce(buildDeploymentClosedAppError(0))
        .mockRejectedValueOnce(buildDeploymentClosedAppError(0))
        .mockResolvedValueOnce(buildOkTx());
      const { service, logger, wallet } = setup({
        staleDeployments: ["1", "2", "3", "4", "5"],
        executeDerivedTx
      });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(4);
      expect(executeDerivedTx).toHaveBeenLastCalledWith(wallet.id, [
        expect.objectContaining({ value: expect.objectContaining({ dseq: "4" }) }),
        expect.objectContaining({ value: expect.objectContaining({ dseq: "5" }) })
      ]);
      expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_DROP_LIMIT" }));
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: OWNER, alreadyClosedCount: 3 });
    });

    it("spends one drop budget across all of an owner's transactions rather than one per transaction", async () => {
      const executeDerivedTx = vi
        .fn()
        .mockRejectedValueOnce(buildDeploymentClosedAppError(0))
        .mockRejectedValueOnce(buildDeploymentClosedAppError(0))
        .mockResolvedValueOnce(buildOkTx())
        .mockRejectedValueOnce(buildDeploymentClosedAppError(0))
        .mockRejectedValueOnce(buildDeploymentClosedAppError(0));
      const dseqs = Array.from({ length: 25 }, (_, index) => String(index + 1));
      const { service, logger, wallet } = setup({ staleDeployments: dseqs, executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(5);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_DROP_LIMIT", owner: OWNER }));
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS" }));
    });

    it("treats a landed tx that reverted on a closed deployment as a failure and drops it", async () => {
      const revertedTx = mock<IndexedTx>({ code: 8, hash: "tx-hash", rawLog: "failed to execute message; message index: 0: Deployment closed" });
      const executeDerivedTx = vi.fn().mockResolvedValueOnce(revertedTx).mockResolvedValueOnce(buildOkTx());
      const { service, logger, wallet } = setup({ staleDeployments: ["1", "2"], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: OWNER, dseq: "1" });
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: OWNER, alreadyClosedCount: 1 });
    });

    it("composes the fee refill with the closed-deployment drop", async () => {
      const executeDerivedTx = vi
        .fn()
        .mockRejectedValueOnce(new Error(FEE_GRANT_REFUSED))
        .mockRejectedValueOnce(buildDeploymentClosedAppError(0))
        .mockResolvedValueOnce(buildOkTx());
      const { service, managedUserWalletService, logger, wallet } = setup({ staleDeployments: ["1", "2"], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledTimes(1);
      expect(executeDerivedTx).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: OWNER, alreadyClosedCount: 1 });
    });

    it("logs the unsettleable event when the re-broadcast after a drop hits the escrow underflow", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(buildDeploymentClosedAppError(0)).mockRejectedValueOnce(buildUnsettleableAppError());
      const { service, logger, wallet } = setup({ staleDeployments: ["1", "2"], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: OWNER, dseq: "1" });
      expect(logger.error).toHaveBeenCalledWith(UNSETTLEABLE_LOG);
    });
  });

  describe("cleanup", () => {
    it("asks the chain once per batch of wallets instead of once per wallet", async () => {
      const { service, deploymentRepository, blockRepository } = setup({ walletBatches: [5, 5, 3] });

      await service.cleanup({ concurrency: 3, dryRun: false });

      expect(deploymentRepository.findStaleDeployments).toHaveBeenCalledTimes(3);
      expect(blockRepository.getLatestProcessedHeight).toHaveBeenCalledTimes(1);
    });

    it("screens every wallet of a batch against the same cutoff in one call", async () => {
      const { service, deploymentRepository } = setup({ currentHeight: 1_000_000, walletBatches: [3] });

      await service.cleanup({ concurrency: 3, dryRun: false });

      const [{ owners, staleBeforeHeight }] = deploymentRepository.findStaleDeployments.mock.calls[0];
      expect(owners).toHaveLength(3);
      expect(staleBeforeHeight).toBeLessThan(1_000_000);
    });

    it("closes each owner's orphans in that owner's own transaction", async () => {
      const { service, managedSignerService } = setup({
        orphans: [
          { owner: "akash1a", dseq: "1" },
          { owner: "akash1a", dseq: "2" },
          { owner: "akash1b", dseq: "3" }
        ],
        walletIdsByAddress: { akash1a: 11, akash1b: 22 }
      });

      await service.cleanup({ concurrency: 2, dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(11, [
        expect.objectContaining({ value: expect.objectContaining({ dseq: "1" }) }),
        expect.objectContaining({ value: expect.objectContaining({ dseq: "2" }) })
      ]);
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(22, [expect.objectContaining({ value: expect.objectContaining({ dseq: "3" }) })]);
    });

    it("broadcasts nothing for a batch that holds no orphan", async () => {
      const { service, managedSignerService } = setup({ walletBatches: [4], orphans: [] });

      await service.cleanup({ concurrency: 2, dryRun: false });

      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("reports what it would close without broadcasting on a dry run", async () => {
      const { service, managedSignerService, logger } = setup({ orphans: [{ owner: OWNER, dseq: "9" }] });

      const result = await service.cleanup({ concurrency: 1, dryRun: true });

      expect(result.ok).toBe(true);
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_WOULD_CLOSE", owner: OWNER, dseqs: ["9"] });
    });

    it("carries on to the other owners and still succeeds when one of them fails", async () => {
      const failure = new Error("some unexpected failure");
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(buildOkTx());
      const { service, logger, errorLogger } = setup({
        orphans: [
          { owner: "akash1a", dseq: "1" },
          { owner: "akash1b", dseq: "2" }
        ],
        walletIdsByAddress: { akash1a: 11, akash1b: 22 },
        executeDerivedTx
      });

      const result = await service.cleanup({ concurrency: 1, dryRun: false });

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
      expect(errorLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_ERROR", error: failure }));
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_SWEEP_END", failedOwners: 1, screenFailures: 0 }));
    });

    it("succeeds without an error when every owner closes", async () => {
      const { service } = setup({ orphans: [{ owner: OWNER, dseq: "1" }] });

      const result = await service.cleanup({ concurrency: 1, dryRun: false });

      expect(result.ok).toBe(true);
    });

    it("reports how long the sweep took", async () => {
      const { service, logger } = setup();

      await service.cleanup({ concurrency: 1, dryRun: false });

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_SWEEP_END", durationMs: expect.any(Number) }));
    });

    it("carries on to the next batch but fails the run when screening one of them fails", async () => {
      const screenFailure = new Error("chain db timed out");
      const { service, deploymentRepository, logger } = setup({ walletBatches: [2, 2] });
      deploymentRepository.findStaleDeployments.mockRejectedValueOnce(screenFailure).mockResolvedValueOnce([]);

      const result = await service.cleanup({ concurrency: 1, dryRun: false });

      expect(deploymentRepository.findStaleDeployments).toHaveBeenCalledTimes(2);
      expect(result.err).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_SWEEP_END", screenFailures: 1, failedOwners: 0 }));
    });

    it("logs the unsettleable event and swallows the error without refilling fees or retrying", async () => {
      const { service, managedSignerService, managedUserWalletService, logger, errorLogger } = setup({
        executeDerivedTx: vi.fn().mockRejectedValue(buildUnsettleableAppError())
      });

      const result = await service.cleanup({ concurrency: 1, dryRun: false });

      expect(result.ok).toBe(true);
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(UNSETTLEABLE_LOG);
      expect(errorLogger.error).not.toHaveBeenCalled();
    });

    it("refills fees and retries when the master wallet no longer pays the wallet's fees", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(new Error(FEE_GRANT_REFUSED)).mockResolvedValueOnce(buildOkTx());
      const { service, managedUserWalletService, logger } = setup({ executeDerivedTx });

      await service.cleanup({ concurrency: 1, dryRun: false });

      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledTimes(1);
      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("logs the unsettleable event when the fee-authorized retry hits the escrow underflow", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(new Error(FEE_GRANT_REFUSED)).mockRejectedValueOnce(buildUnsettleableAppError());
      const { service, managedUserWalletService, logger } = setup({ executeDerivedTx });

      await service.cleanup({ concurrency: 1, dryRun: false });

      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledTimes(1);
      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(UNSETTLEABLE_LOG);
    });
  });

  describe("when the indexer trails the chain", () => {
    it("refuses to sweep rather than read a leased deployment as an orphan", async () => {
      const { service, deploymentRepository, managedSignerService, logger } = setup({ currentHeight: 1_000_000, chainHeight: 1_000_500 });

      const result = await service.cleanup({ concurrency: 1, dryRun: false });

      expect(result.err).toBe(true);
      expect(deploymentRepository.findStaleDeployments).not.toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_INDEXER_LAGGING", chainHeight: 1_000_500, indexedHeight: 1_000_000 })
      );
    });

    it("sweeps when the indexer is within the tolerated lag", async () => {
      const { service, deploymentRepository } = setup({ currentHeight: 1_000_000, chainHeight: 1_000_050 });

      const result = await service.cleanup({ concurrency: 1, dryRun: false });

      expect(result.ok).toBe(true);
      expect(deploymentRepository.findStaleDeployments).toHaveBeenCalled();
    });
  });

  function buildUnsettleableAppError() {
    return createError(400, "Deployment escrow cannot be settled yet", { originalError: new Error(UNSETTLEABLE_PANIC) });
  }

  function buildDeploymentClosedAppError(index?: number) {
    const rawMessage =
      index === undefined
        ? "Query failed with (6): rpc error: code = Unknown desc = Deployment closed"
        : `Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: ${index}: Deployment closed`;

    return createError(400, "Deployment closed", { originalError: new Error(rawMessage) });
  }

  function buildOkTx() {
    return mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" });
  }

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: StaleManagedDeploymentsCleanerService.name });
  });

  it("creates the error service logger with the service context", () => {
    const { createErrorLogger } = setup();

    expect(createErrorLogger).toHaveBeenCalledWith({ context: ErrorService.name });
  });

  function setup(input?: {
    currentHeight?: number;
    chainHeight?: number;
    staleDeployments?: string[];
    orphans?: StaleDeployment[];
    walletBatches?: number[];
    walletIdsByAddress?: Record<string, number>;
    executeDerivedTx?: ManagedSignerService["executeDerivedTx"];
  }) {
    const wallet = createUserWallet({ id: 123, address: OWNER });
    const orphans = input?.orphans ?? (input?.staleDeployments ?? ["456"]).map(dseq => ({ owner: OWNER, dseq }));
    const walletIdsByAddress = input?.walletIdsByAddress ?? { [OWNER]: wallet.id };

    const walletBatches: ManagedWalletRef[][] = input?.walletBatches
      ? input.walletBatches.map((size, batch) =>
          Array.from({ length: size }, (_, index) => ({ id: 1000 + batch * 10 + index, address: `akash1owner${batch}${index}` }))
        )
      : [Object.entries(walletIdsByAddress).map(([address, id]) => ({ id, address }))];

    const userWalletRepository = mock<UserWalletRepository>({
      findManagedIteratively: vi.fn(async function* () {
        for (const batch of walletBatches) yield batch;
      }) as UserWalletRepository["findManagedIteratively"]
    });
    const deploymentRepository = mock<DeploymentRepository>();
    const blockRepository = mock<BlockRepository>();
    const blockHttpService = mock<BlockHttpService>();
    const rpcMessageService = mock<RpcMessageService>();
    const managedSignerService = mock<ManagedSignerService>({
      executeDerivedTx: input?.executeDerivedTx ?? vi.fn().mockResolvedValue(buildOkTx())
    });
    const managedUserWalletService = mock<ManagedUserWalletService>();
    const config = mock<BillingConfig>({ FEE_ALLOWANCE_REFILL_AMOUNT: 1000 });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const errorLogger = mock<ReturnType<CreateLogger>>();
    const createErrorLogger = vi.fn<CreateLogger>(() => errorLogger);
    const errorService = new ErrorService(createErrorLogger);
    const chainErrorService = new ChainErrorService(mock<BalanceHttpService>(), mock<BillingConfigService>(), mock<TxManagerService>());

    const currentHeight = input?.currentHeight ?? 1_000_000;
    blockRepository.getLatestProcessedHeight.mockResolvedValue(currentHeight);
    blockHttpService.getCurrentHeight.mockResolvedValue(input?.chainHeight ?? currentHeight);
    deploymentRepository.findStaleDeployments.mockImplementation(async ({ owners }) => orphans.filter(orphan => owners.includes(orphan.owner)));
    rpcMessageService.getCloseDeploymentMsg.mockImplementation((_address, dseq) => ({ typeUrl: "/close", value: { dseq } }) as never);

    const service = new StaleManagedDeploymentsCleanerService(
      userWalletRepository,
      deploymentRepository,
      blockRepository,
      blockHttpService,
      rpcMessageService,
      managedSignerService,
      config,
      managedUserWalletService,
      errorService,
      chainErrorService,
      createLogger
    );

    return {
      service,
      wallet,
      userWalletRepository,
      deploymentRepository,
      blockRepository,
      blockHttpService,
      rpcMessageService,
      managedSignerService,
      managedUserWalletService,
      chainErrorService,
      logger,
      createLogger,
      errorLogger,
      createErrorLogger
    };
  }
});
