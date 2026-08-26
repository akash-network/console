import type { BalanceHttpService } from "@akashnetwork/http-sdk";
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
import type { CreateLogger, LoggerService } from "@src/core/providers/logging.provider";
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
      const executeDerivedTx = vi.fn().mockRejectedValueOnce(new Error("not allowed to pay fees")).mockResolvedValueOnce(undefined);
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

  it("creates the error service logger with the service context", () => {
    const { createErrorLogger } = setup();

    expect(createErrorLogger).toHaveBeenCalledWith({ context: ErrorService.name });
  });

  function setup(input?: { currentHeight?: number; staleDeployments?: { dseq: number }[]; executeDerivedTx?: ManagedSignerService["executeDerivedTx"] }) {
    const wallet = createUserWallet({ id: 123, address: "akash1test" });

    const userWalletRepository = mock<UserWalletRepository>({
      paginate: vi.fn(async (_options, cb) => {
        await cb([wallet]);
      }) as UserWalletRepository["paginate"]
    });
    const deploymentRepository = mock<DeploymentRepository>();
    const blockRepository = mock<BlockRepository>();
    const rpcMessageService = mock<RpcMessageService>();
    const managedSignerService = mock<ManagedSignerService>({
      executeDerivedTx: input?.executeDerivedTx ?? vi.fn().mockResolvedValue(undefined)
    });
    const managedUserWalletService = mock<ManagedUserWalletService>();
    const config = mock<BillingConfig>({ FEE_ALLOWANCE_REFILL_AMOUNT: 1000 });
    const logger = mock<LoggerService>();
    const errorLogger = mock<ReturnType<CreateLogger>>();
    const createErrorLogger = vi.fn<CreateLogger>(() => errorLogger);
    const errorService = new ErrorService(createErrorLogger);
    const chainErrorService = new ChainErrorService(mock<BalanceHttpService>(), mock<BillingConfigService>(), mock<TxManagerService>());

    blockRepository.getLatestProcessedHeight.mockResolvedValue(input?.currentHeight ?? 1_000_000);
    deploymentRepository.findStaleDeployments.mockResolvedValue(input?.staleDeployments ?? [{ dseq: 456 }]);

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
      logger
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
      errorLogger,
      createErrorLogger
    };
  }
});
