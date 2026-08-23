import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { LoggerService } from "@src/core";
import type { DeploymentSettingRepository, ExpiredRuntimeDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { ExpiredDeploymentsCloserService } from "./expired-deployments-closer.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(ExpiredDeploymentsCloserService.name, () => {
  it("closes an expired deployment and marks the setting closed", async () => {
    const expired = createExpiredRuntimeDeployment();
    const { service, deploymentWriterService, deploymentSettingRepository } = setup({ expired: [expired] });

    const result = await service.closeExpiredDeployments({ dryRun: false });

    expect(deploymentWriterService.close).toHaveBeenCalledWith(expect.objectContaining({ address: expired.address }), expired.dseq);
    expect(deploymentSettingRepository.updateById).toHaveBeenCalledWith(expired.id, { closed: true });
    expect(result.ok).toBe(true);
  });

  it("neither closes nor marks anything on a dry run", async () => {
    const expired = createExpiredRuntimeDeployment();
    const { service, deploymentWriterService, deploymentSettingRepository } = setup({ expired: [expired] });

    const result = await service.closeExpiredDeployments({ dryRun: true });

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.updateById).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("skips a deployment whose wallet is not initialized", async () => {
    const expired = createExpiredRuntimeDeployment();
    const { service, deploymentWriterService, deploymentSettingRepository } = setup({ expired: [expired], walletAddress: null });

    const result = await service.closeExpiredDeployments({ dryRun: false });

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(deploymentSettingRepository.updateById).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("leaves an unsettleable deployment for the next pass", async () => {
    const expired = createExpiredRuntimeDeployment();
    const { service, deploymentSettingRepository } = setup({
      expired: [expired],
      closeError: new Error("escrow not settled"),
      isUnsettleable: true
    });

    const result = await service.closeExpiredDeployments({ dryRun: false });

    expect(deploymentSettingRepository.updateById).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("keeps closing the rest when one deployment fails and reports the failure", async () => {
    const failing = createExpiredRuntimeDeployment();
    const succeeding = createExpiredRuntimeDeployment();
    const closeError = new Error("broadcast failed");
    const { service, deploymentWriterService, deploymentSettingRepository } = setup({ expired: [failing, succeeding] });
    deploymentWriterService.close.mockRejectedValueOnce(closeError);

    const result = await service.closeExpiredDeployments({ dryRun: false });

    expect(deploymentWriterService.close).toHaveBeenCalledTimes(2);
    expect(deploymentSettingRepository.updateById).toHaveBeenCalledExactlyOnceWith(succeeding.id, { closed: true });
    expect(result.err).toBe(true);
    expect(result.val).toEqual([closeError]);
  });

  it("reports success when nothing has expired", async () => {
    const { service, deploymentWriterService } = setup({ expired: [] });

    const result = await service.closeExpiredDeployments({ dryRun: false });

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  function createExpiredRuntimeDeployment(overrides: Partial<ExpiredRuntimeDeployment> = {}): ExpiredRuntimeDeployment {
    return {
      id: faker.string.uuid(),
      dseq: faker.string.numeric(6),
      walletId: faker.number.int({ min: 1, max: 10000 }),
      address: createAkashAddress(),
      ...overrides
    };
  }

  function setup(input: { expired: ExpiredRuntimeDeployment[]; walletAddress?: string | null; closeError?: Error; isUnsettleable?: boolean }) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentWriterService = mock<DeploymentWriterService>();
    const chainErrorService = mock<ChainErrorService>();
    const logger = mock<LoggerService>();

    deploymentSettingRepository.findExpiredRuntimeDeployments.mockResolvedValue(input.expired);
    userWalletRepository.findById.mockImplementation(async walletId => {
      const deployment = input.expired.find(candidate => candidate.walletId === walletId);
      return createUserWallet({
        id: walletId,
        address: input.walletAddress === null ? null : input.walletAddress ?? deployment?.address
      });
    });
    chainErrorService.isUnsettleableDeploymentError.mockReturnValue(input.isUnsettleable ?? false);

    if (input.closeError) {
      deploymentWriterService.close.mockRejectedValue(input.closeError);
    }

    const service = new ExpiredDeploymentsCloserService(deploymentSettingRepository, userWalletRepository, deploymentWriterService, chainErrorService, logger);

    return { service, deploymentSettingRepository, userWalletRepository, deploymentWriterService, chainErrorService, logger };
  }
});
