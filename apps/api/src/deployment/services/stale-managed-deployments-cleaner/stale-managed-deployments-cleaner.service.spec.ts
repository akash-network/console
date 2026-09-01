import type { BalanceHttpService } from "@akashnetwork/http-sdk";
import type { IndexedTx } from "@cosmjs/stargate";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { BlockRepository } from "@src/chain/repositories/block.repository";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ErrorService } from "@src/core/services/error/error.service";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { StaleManagedDeploymentsCleanerService } from "./stale-managed-deployments-cleaner.service";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const UNSETTLEABLE_PANIC = "Query failed with (6): rpc error: code = Unknown desc = recovered: negative decimal coin amount: -2.000000000000000000";
const UNSETTLEABLE_LOG = {
  event: "DEPLOYMENT_CLEAN_UP_UNSETTLEABLE",
  reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
  owner: "akash1test"
};

describe(StaleManagedDeploymentsCleanerService.name, () => {
  describe("cleanUpForWallet", () => {
    it("cuts off well below the current height when no age override is passed", async () => {
      const { service, deploymentRepository, wallet } = setup({ currentHeight: 1_000_000 });

      await service.cleanUpForWallet(wallet);

      const cutoff = deploymentRepository.findStaleDeployments.mock.calls[0][0].createdHeight;
      expect(cutoff).toBeLessThan(1_000_000);
    });

    it("uses the current height as the cutoff when age 0 is passed so every lease-less deployment is stale", async () => {
      const { service, deploymentRepository, wallet } = setup({ currentHeight: 1_000_000 });

      await service.cleanUpForWallet(wallet, 0);

      expect(deploymentRepository.findStaleDeployments).toHaveBeenCalledWith({ owner: wallet.address, createdHeight: 1_000_000 });
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
      const { service, managedSignerService, rpcMessageService, wallet } = setup({ staleDeployments: [{ dseq: 1 }, { dseq: 2 }] });
      rpcMessageService.getCloseDeploymentMsg.mockReturnValue(closeMsg as never);

      await service.cleanUpForWallet(wallet, 0);

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(wallet.id, [closeMsg, closeMsg]);
    });
  });

  describe("when a deployment is already closed on chain", () => {
    it("drops the closed deployment and closes the rest in a second broadcast", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(buildDeploymentClosedAppError(1)).mockResolvedValueOnce(buildOkTx());
      const { service, logger, wallet } = setup({ staleDeployments: [{ dseq: 1 }, { dseq: 2 }, { dseq: 3 }], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(executeDerivedTx).toHaveBeenLastCalledWith(wallet.id, [
        expect.objectContaining({ value: expect.objectContaining({ dseq: 1 }) }),
        expect.objectContaining({ value: expect.objectContaining({ dseq: 3 }) })
      ]);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: wallet.address, dseq: 2 });
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address, alreadyClosedCount: 1 });
    });

    it("resolves quietly when the wallet's only orphan is already closed and the error carries no index", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(buildDeploymentClosedAppError());
      const { service, logger, errorLogger, wallet } = setup({ staleDeployments: [{ dseq: 7 }], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: wallet.address, dseq: 7 });
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address, alreadyClosedCount: 1 });
      expect(logger.error).not.toHaveBeenCalled();
      expect(errorLogger.error).not.toHaveBeenCalled();
    });

    it("reports success without an error when the whole batch is already closed", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValue(buildDeploymentClosedAppError(0));
      const { service, logger, errorLogger, wallet } = setup({ staleDeployments: [{ dseq: 1 }, { dseq: 2 }], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address, alreadyClosedCount: 2 });
      expect(logger.error).not.toHaveBeenCalled();
      expect(errorLogger.error).not.toHaveBeenCalled();
    });

    it("rethrows into the wallet error handler when the reported index falls outside the batch", async () => {
      const error = buildDeploymentClosedAppError(7);
      const { service, managedSignerService, logger, errorLogger } = setup({
        staleDeployments: [{ dseq: 1 }, { dseq: 2 }],
        executeDerivedTx: vi.fn().mockRejectedValue(error)
      });

      await expect(service.cleanup({ concurrency: 1 })).resolves.toBeUndefined();

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED" }));
      expect(errorLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_ERROR", error }));
    });

    it("stops after the drop limit without reporting an error when too many deployments turn out closed", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValue(buildDeploymentClosedAppError(0));
      const { service, logger, errorLogger, wallet } = setup({
        staleDeployments: [{ dseq: 1 }, { dseq: 2 }, { dseq: 3 }, { dseq: 4 }, { dseq: 5 }],
        executeDerivedTx
      });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_DROP_LIMIT", owner: wallet.address, remainingCount: 2 });
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS" }));
      expect(logger.error).not.toHaveBeenCalled();
      expect(errorLogger.error).not.toHaveBeenCalled();
    });

    it("treats a landed tx that reverted on a closed deployment as a failure and drops it", async () => {
      const revertedTx = mock<IndexedTx>({ code: 8, hash: "tx-hash", rawLog: "failed to execute message; message index: 0: Deployment closed" });
      const executeDerivedTx = vi.fn().mockResolvedValueOnce(revertedTx).mockResolvedValueOnce(buildOkTx());
      const { service, logger, wallet } = setup({ staleDeployments: [{ dseq: 1 }, { dseq: 2 }], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: wallet.address, dseq: 1 });
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address, alreadyClosedCount: 1 });
    });

    it("composes the fee refill with the closed-deployment drop", async () => {
      const executeDerivedTx = vi
        .fn()
        .mockRejectedValueOnce(new Error("not allowed to pay fees"))
        .mockRejectedValueOnce(buildDeploymentClosedAppError(0))
        .mockResolvedValueOnce(buildOkTx());
      const { service, managedUserWalletService, logger, wallet } = setup({ staleDeployments: [{ dseq: 1 }, { dseq: 2 }], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledTimes(1);
      expect(executeDerivedTx).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_SUCCESS", owner: wallet.address, alreadyClosedCount: 1 });
    });

    it("logs the unsettleable event when the re-broadcast after a drop hits the escrow underflow", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(buildDeploymentClosedAppError(0)).mockRejectedValueOnce(buildUnsettleableAppError());
      const { service, logger, wallet } = setup({ staleDeployments: [{ dseq: 1 }, { dseq: 2 }], executeDerivedTx });

      await service.cleanUpForWallet(wallet, 0);

      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith({ event: "DEPLOYMENT_CLEAN_UP_ALREADY_CLOSED", owner: wallet.address, dseq: 1 });
      expect(logger.error).toHaveBeenCalledWith(UNSETTLEABLE_LOG);
    });
  });

  describe("cleanup", () => {
    it("logs the unsettleable event and swallows the error without refilling fees or retrying", async () => {
      const { service, managedSignerService, managedUserWalletService, logger, errorLogger } = setup({
        executeDerivedTx: vi.fn().mockRejectedValue(buildUnsettleableAppError())
      });

      await expect(service.cleanup({ concurrency: 1 })).resolves.toBeUndefined();

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(UNSETTLEABLE_LOG);
      expect(errorLogger.error).not.toHaveBeenCalled();
    });

    it("refills fees and retries when the wallet is not allowed to pay fees", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(new Error("not allowed to pay fees")).mockResolvedValueOnce(buildOkTx());
      const { service, managedUserWalletService, logger } = setup({ executeDerivedTx });

      await service.cleanup({ concurrency: 1 });

      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledTimes(1);
      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("logs the unsettleable event when the fee-authorized retry hits the escrow underflow", async () => {
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(new Error("not allowed to pay fees")).mockRejectedValueOnce(buildUnsettleableAppError());
      const { service, managedUserWalletService, logger } = setup({ executeDerivedTx });

      await expect(service.cleanup({ concurrency: 1 })).resolves.toBeUndefined();

      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledTimes(1);
      expect(executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(UNSETTLEABLE_LOG);
    });

    it("reads the chain height once for the whole sweep", async () => {
      const { service, blockRepository, deploymentRepository } = setup({ pages: 4, walletsPerPage: 3 });

      await service.cleanup({ concurrency: 3 });

      expect(blockRepository.getLatestProcessedHeight).toHaveBeenCalledTimes(1);
      expect(deploymentRepository.findStaleDeployments).toHaveBeenCalledTimes(12);
    });

    it("screens every wallet against the same cutoff", async () => {
      const { service, deploymentRepository } = setup({ currentHeight: 1_000_000, pages: 3, walletsPerPage: 2 });

      await service.cleanup({ concurrency: 2 });

      const cutoffs = new Set(deploymentRepository.findStaleDeployments.mock.calls.map(([{ createdHeight }]) => createdHeight));
      expect(cutoffs.size).toBe(1);
      expect([...cutoffs][0]).toBeLessThan(1_000_000);
    });

    it("rethrows unrelated errors into the wallet error handler without retrying", async () => {
      const unexpectedError = new Error("some unexpected failure");
      const { service, managedSignerService, managedUserWalletService, logger, errorLogger } = setup({
        executeDerivedTx: vi.fn().mockRejectedValue(unexpectedError)
      });

      await expect(service.cleanup({ concurrency: 1 })).resolves.toBeUndefined();

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
      expect(errorLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_CLEAN_UP_ERROR", error: unexpectedError }));
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
    staleDeployments?: { dseq: number }[];
    executeDerivedTx?: ManagedSignerService["executeDerivedTx"];
    pages?: number;
    walletsPerPage?: number;
  }) {
    const wallet = createUserWallet({ id: 123, address: "akash1test" });

    const walletPages = Array.from({ length: input?.pages ?? 1 }, (_, page) =>
      Array.from({ length: input?.walletsPerPage ?? 1 }, (_, index) =>
        page === 0 && index === 0 ? wallet : createUserWallet({ id: 1000 + page * 10 + index, address: `akash1owner${page}${index}` })
      )
    );

    const userWalletRepository = mock<UserWalletRepository>({
      paginate: vi.fn(async (_options, cb) => {
        for (const page of walletPages) {
          await cb(page);
        }
      }) as UserWalletRepository["paginate"]
    });
    const deploymentRepository = mock<DeploymentRepository>();
    const blockRepository = mock<BlockRepository>();
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

    blockRepository.getLatestProcessedHeight.mockResolvedValue(input?.currentHeight ?? 1_000_000);
    deploymentRepository.findStaleDeployments.mockResolvedValue(input?.staleDeployments ?? [{ dseq: 456 }]);
    rpcMessageService.getCloseDeploymentMsg.mockImplementation((_address, dseq) => ({ typeUrl: "/close", value: { dseq } }) as never);

    const service = new StaleManagedDeploymentsCleanerService(
      userWalletRepository,
      deploymentRepository,
      blockRepository,
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
