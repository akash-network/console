import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { BlockRepository } from "@src/chain/repositories/block.repository";
import type { ErrorService } from "@src/core/services/error/error.service";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { StaleManagedDeploymentsCleanerService } from "./stale-managed-deployments-cleaner.service";

describe(StaleManagedDeploymentsCleanerService.name, () => {
  const wallet = mock<UserWalletOutput>({ id: 1, address: "akash1testaddr" });

  it("cuts off well below the current height when no age override is passed", async () => {
    const { service, deploymentRepository } = setup({ currentHeight: 1_000_000 });

    await service.cleanUpForWallet(wallet);

    const cutoff = deploymentRepository.findStaleDeployments.mock.calls[0][0].createdHeight;
    expect(cutoff).toBeLessThan(1_000_000);
  });

  it("uses the current height as the cutoff when age 0 is passed so every lease-less deployment is stale", async () => {
    const { service, deploymentRepository } = setup({ currentHeight: 1_000_000 });

    await service.cleanUpForWallet(wallet, 0);

    expect(deploymentRepository.findStaleDeployments).toHaveBeenCalledWith({ owner: wallet.address, createdHeight: 1_000_000 });
  });

  it("does not broadcast when there are no stale deployments", async () => {
    const { service, managedSignerService } = setup({ staleDeployments: [] });

    await service.cleanUpForWallet(wallet, 0);

    expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
  });

  it("closes all stale deployments in a single derived tx", async () => {
    const closeMsg = { typeUrl: "/close", value: {} };
    const { service, managedSignerService, rpcMessageService } = setup({ staleDeployments: [{ dseq: 1 }, { dseq: 2 }] });
    rpcMessageService.getCloseDeploymentMsg.mockReturnValue(closeMsg as never);

    await service.cleanUpForWallet(wallet, 0);

    expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(wallet.id, [closeMsg, closeMsg]);
  });

  function setup(input?: { currentHeight?: number; staleDeployments?: { dseq: number }[] }) {
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentRepository = mock<DeploymentRepository>();
    const blockRepository = mock<BlockRepository>();
    const rpcMessageService = mock<RpcMessageService>();
    const managedSignerService = mock<ManagedSignerService>();
    const config = mock<BillingConfig>();
    const managedUserWalletService = mock<ManagedUserWalletService>();
    const errorService = mock<ErrorService>();

    blockRepository.getLatestProcessedHeight.mockResolvedValue(input?.currentHeight ?? 1_000_000);
    deploymentRepository.findStaleDeployments.mockResolvedValue(input?.staleDeployments ?? []);

    const service = new StaleManagedDeploymentsCleanerService(
      userWalletRepository,
      deploymentRepository,
      blockRepository,
      rpcMessageService,
      managedSignerService,
      config,
      managedUserWalletService,
      errorService
    );

    return {
      service,
      userWalletRepository,
      deploymentRepository,
      blockRepository,
      rpcMessageService,
      managedSignerService,
      config,
      managedUserWalletService,
      errorService
    };
  }
});
