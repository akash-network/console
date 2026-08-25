import { PostgresError } from "postgres";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { LoggerService } from "@src/core";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DeploymentSettingsBackfillService } from "./deployment-settings-backfill.service";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(DeploymentSettingsBackfillService.name, () => {
  it("creates settings rows for open deployments that lack them", async () => {
    const { service, leaseRepository, deploymentSettingRepository } = setup();
    leaseRepository.findOpenDseqsByOwner.mockResolvedValue(["1", "2", "3"]);
    deploymentSettingRepository.find.mockResolvedValue([mock<DeploymentSettingsOutput>({ dseq: "2" })]);

    const summary = await service.backfillDeploymentSettings({ dryRun: false });

    expect(leaseRepository.findOpenDseqsByOwner).toHaveBeenCalledWith("akash1owner");
    expect(deploymentSettingRepository.create).toHaveBeenCalledWith({ userId: "user-1", dseq: "1" });
    expect(deploymentSettingRepository.create).toHaveBeenCalledWith({ userId: "user-1", dseq: "3" });
    expect(deploymentSettingRepository.create).not.toHaveBeenCalledWith({ userId: "user-1", dseq: "2" });
    expect(summary).toEqual({ scannedWallets: 1, openDeployments: 3, missingSettings: 2, createdSettings: 2 });
  });

  it("only counts the missing rows on a dry run", async () => {
    const { service, deploymentSettingRepository } = setup();
    deploymentSettingRepository.find.mockResolvedValue([]);

    const summary = await service.backfillDeploymentSettings({ dryRun: true });

    expect(deploymentSettingRepository.create).not.toHaveBeenCalled();
    expect(summary).toEqual({ scannedWallets: 1, openDeployments: 1, missingSettings: 1, createdSettings: 0 });
  });

  it("skips wallets without an address", async () => {
    const { service, leaseRepository } = setup({ wallets: [createUserWallet({ address: null })] });

    const summary = await service.backfillDeploymentSettings({ dryRun: true });

    expect(leaseRepository.findOpenDseqsByOwner).not.toHaveBeenCalled();
    expect(summary.scannedWallets).toBe(0);
  });

  it("does not read settings for a wallet without open leases", async () => {
    const { service, leaseRepository, deploymentSettingRepository } = setup();
    leaseRepository.findOpenDseqsByOwner.mockResolvedValue([]);

    const summary = await service.backfillDeploymentSettings({ dryRun: false });

    expect(deploymentSettingRepository.find).not.toHaveBeenCalled();
    expect(summary).toEqual({ scannedWallets: 1, openDeployments: 0, missingSettings: 0, createdSettings: 0 });
  });

  it("treats a row created concurrently as already backfilled", async () => {
    const { service, deploymentSettingRepository } = setup();
    deploymentSettingRepository.find.mockResolvedValue([]);
    deploymentSettingRepository.create.mockRejectedValue(createUniqueViolation());

    const summary = await service.backfillDeploymentSettings({ dryRun: false });

    expect(summary).toEqual({ scannedWallets: 1, openDeployments: 1, missingSettings: 1, createdSettings: 0 });
  });

  it("rethrows insert failures other than the unique race", async () => {
    const { service, deploymentSettingRepository } = setup();
    deploymentSettingRepository.find.mockResolvedValue([]);
    deploymentSettingRepository.create.mockRejectedValue(new Error("db down"));

    await expect(service.backfillDeploymentSettings({ dryRun: false })).rejects.toThrow("db down");
  });

  /** Mirrors how drizzle surfaces a unique violation: a wrapper error carrying the driver error as its cause. */
  function createUniqueViolation() {
    const driverError = Object.assign(Object.create(PostgresError.prototype), {
      name: "PostgresError",
      code: "23505",
      constraint_name: "dseq_user_id_idx",
      message: 'duplicate key value violates unique constraint "dseq_user_id_idx"'
    });

    return new Error("Failed query: insert into deployment_settings", { cause: driverError });
  }

  function setup(input?: { wallets?: UserWalletOutput[] }) {
    const wallets = input?.wallets ?? [createUserWallet({ userId: "user-1", address: "akash1owner" })];

    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.paginate.mockImplementation(async (_params, cb) => {
      await cb(wallets);
    });

    const leaseRepository = mock<LeaseRepository>();
    leaseRepository.findOpenDseqsByOwner.mockResolvedValue(["1"]);

    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const logger = mock<LoggerService>();

    const service = new DeploymentSettingsBackfillService(userWalletRepository, leaseRepository, deploymentSettingRepository, logger);

    return { service, userWalletRepository, leaseRepository, deploymentSettingRepository, logger };
  }
});
