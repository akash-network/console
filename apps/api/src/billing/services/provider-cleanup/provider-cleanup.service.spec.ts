import type { BalanceHttpService } from "@akashnetwork/http-sdk";
import type { IndexedTx } from "@cosmjs/stargate";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ErrorService } from "@src/core/services/error/error.service";
import type { DeploymentRepository, StaleDeploymentsOutput } from "@src/deployment/repositories/deployment/deployment.repository";
import { ProviderCleanupService } from "./provider-cleanup.service";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const PROVIDER = "akash1provider";
const FEE_GRANT_REFUSED =
  "Broadcasting transaction failed with code 38 (codespace: sdk). Log: akash1master does not allow to pay fees for akash1test: fee-grant not found: not found";
const CLOSE_MSG = mock<ReturnType<RpcMessageService["getCloseDeploymentMsg"]>>({ typeUrl: "/akash.deployment.v1beta4.MsgCloseDeployment" });

describe(ProviderCleanupService.name, () => {
  it("refills the wallet's fees and retries the close when the master wallet no longer pays its fees", async () => {
    const { service, wallet, managedSignerService, managedUserWalletService, errorLogger } = setup();
    managedSignerService.executeDerivedTx.mockRejectedValueOnce(new Error(FEE_GRANT_REFUSED)).mockResolvedValueOnce(buildOkTx());

    await service.cleanup({ provider: PROVIDER, concurrency: 1, dryRun: false });

    expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(managedSignerService, { address: wallet.address, limits: { fees: 1000 } });
    expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(2);
    expect(managedSignerService.executeDerivedTx).toHaveBeenLastCalledWith(wallet.id, [CLOSE_MSG]);
    expect(errorLogger.error).not.toHaveBeenCalled();
  });

  it("reports any other close failure for the wallet without refilling its fees", async () => {
    const failure = new Error("account sequence mismatch");
    const { service, managedSignerService, managedUserWalletService, errorLogger } = setup();
    managedSignerService.executeDerivedTx.mockRejectedValueOnce(failure);

    await service.cleanup({ provider: PROVIDER, concurrency: 1, dryRun: false });

    expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
    expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
    expect(errorLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "PROVIDER_CLEAN_UP_ERROR", error: failure }));
  });

  function buildOkTx() {
    return mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" });
  }

  function setup() {
    const wallet = createUserWallet({ isTrialing: true });
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.paginate.mockImplementation(async (_options, cb) => {
      await cb([wallet]);
    });
    const deploymentRepository = mock<DeploymentRepository>();
    deploymentRepository.findDeploymentsForProvider.mockResolvedValue([mock<StaleDeploymentsOutput>({ dseq: "1" })]);
    const rpcMessageService = mock<RpcMessageService>();
    rpcMessageService.getCloseDeploymentMsg.mockReturnValue(CLOSE_MSG);
    const managedSignerService = mock<ManagedSignerService>();
    const managedUserWalletService = mock<ManagedUserWalletService>();
    const config = mock<BillingConfig>({ FEE_ALLOWANCE_REFILL_AMOUNT: 1000 });
    const errorLogger = mock<ReturnType<CreateLogger>>();
    const errorService = new ErrorService(vi.fn<CreateLogger>(() => errorLogger));
    const chainErrorService = new ChainErrorService(mock<BalanceHttpService>(), mock<BillingConfigService>(), mock<TxManagerService>());

    const service = new ProviderCleanupService(
      config,
      userWalletRepository,
      managedUserWalletService,
      managedSignerService,
      deploymentRepository,
      rpcMessageService,
      errorService,
      chainErrorService
    );

    return { service, wallet, managedSignerService, managedUserWalletService, errorLogger };
  }
});
