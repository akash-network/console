import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentNameService } from "./deployment-name.service";

import { createInitializedUserWallet, createOrganizationWallet } from "@test/seeders/user-wallet.seeder";

describe(DeploymentNameService.name, () => {
  it("returns the name of the deployment the owner's wallet holds under the dseq", async () => {
    const wallet = createInitializedUserWallet();
    const { service, deploymentSettingRepository, dseq } = setup({ wallet, setting: mock<DeploymentSettingsOutput>({ name: "my-app" }) });

    const name = await service.findName({ owner: wallet.address, dseq });

    expect(name).toBe("my-app");
    expect(deploymentSettingRepository.findOneOwnedByWallet).toHaveBeenCalledWith(wallet, dseq);
  });

  it("looks the deployment up under the wallet of a team that owns it", async () => {
    const wallet = createOrganizationWallet();
    const { service, userWalletRepository, deploymentSettingRepository, dseq } = setup({
      wallet,
      setting: mock<DeploymentSettingsOutput>({ name: "team-app" })
    });

    const name = await service.findName({ owner: wallet.address, dseq });

    expect(name).toBe("team-app");
    expect(userWalletRepository.findOneByAddress).toHaveBeenCalledWith(wallet.address);
    expect(deploymentSettingRepository.findOneOwnedByWallet).toHaveBeenCalledWith(wallet, dseq);
  });

  it("returns null for a deployment that was never named", async () => {
    const wallet = createInitializedUserWallet();
    const { service, dseq } = setup({ wallet, setting: mock<DeploymentSettingsOutput>({ name: null }) });

    expect(await service.findName({ owner: wallet.address, dseq })).toBeNull();
  });

  it("returns null for a deployment Console holds no record of", async () => {
    const wallet = createInitializedUserWallet();
    const { service, dseq } = setup({ wallet, setting: undefined });

    expect(await service.findName({ owner: wallet.address, dseq })).toBeNull();
  });

  it("returns null without looking for a deployment when no Console wallet has the owner's address", async () => {
    const { service, deploymentSettingRepository, dseq } = setup({ wallet: undefined, setting: undefined });

    expect(await service.findName({ owner: "akash1unmanaged", dseq })).toBeNull();
    expect(deploymentSettingRepository.findOneOwnedByWallet).not.toHaveBeenCalled();
  });

  function setup(input: { wallet: UserWalletOutput | undefined; setting: DeploymentSettingsOutput | undefined }) {
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    userWalletRepository.findOneByAddress.mockResolvedValue(input.wallet);
    deploymentSettingRepository.findOneOwnedByWallet.mockResolvedValue(input.setting);

    const service = new DeploymentNameService(userWalletRepository, deploymentSettingRepository);

    return { service, userWalletRepository, deploymentSettingRepository, dseq: faker.string.numeric(8) };
  }
});
