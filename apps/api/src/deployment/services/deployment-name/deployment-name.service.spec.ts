import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentNameService } from "./deployment-name.service";

import { createInitializedUserWallet, createOrganizationWallet } from "@test/seeders/user-wallet.seeder";

describe(DeploymentNameService.name, () => {
  it("returns the name of a deployment on the reader's own wallet", async () => {
    const wallet = createInitializedUserWallet();
    const { service, userWalletRepository, deploymentSettingRepository, dseq } = setup({ wallet, name: "my-app" });

    const name = await service.findName({ owner: wallet.address, dseq, reader: { userId: wallet.userId } });

    expect(name).toBe("my-app");
    expect(userWalletRepository.findOneByAddress).toHaveBeenCalledWith(wallet.address);
    expect(deploymentSettingRepository.findOneOfWallet).toHaveBeenCalledWith(wallet, dseq);
  });

  it("returns the name of a deployment on the reader's own wallet for an alert filed in an organization the wallet is not", async () => {
    const wallet = createInitializedUserWallet();
    const { service, dseq } = setup({ wallet, name: "my-app" });

    expect(await service.findName({ owner: wallet.address, dseq, reader: { userId: wallet.userId, organizationId: faker.string.uuid() } })).toBe("my-app");
  });

  it("returns the name of a deployment on the wallet of the organization the reader's alert is filed in", async () => {
    const organizationId = faker.string.uuid();
    const wallet = createOrganizationWallet({ organizationId });
    const { service, dseq } = setup({ wallet, name: "team-app" });

    const name = await service.findName({ owner: wallet.address, dseq, reader: { userId: faker.string.uuid(), organizationId } });

    expect(name).toBe("team-app");
  });

  it("returns null without looking for a deployment on another organization's wallet", async () => {
    const wallet = createOrganizationWallet();
    const { service, deploymentSettingRepository, dseq } = setup({ wallet, name: "team-app" });

    const name = await service.findName({ owner: wallet.address, dseq, reader: { userId: faker.string.uuid(), organizationId: faker.string.uuid() } });

    expect(name).toBeNull();
    expect(deploymentSettingRepository.findOneOfWallet).not.toHaveBeenCalled();
  });

  it("returns null for a deployment on another user's wallet", async () => {
    const wallet = createInitializedUserWallet();
    const { service, dseq } = setup({ wallet, name: "my-app" });

    expect(await service.findName({ owner: wallet.address, dseq, reader: { userId: faker.string.uuid() } })).toBeNull();
  });

  it("returns null for a deployment on an organization's wallet when the reader's alert is filed in no organization", async () => {
    const wallet = createOrganizationWallet();
    const { service, dseq } = setup({ wallet, name: "team-app" });

    expect(await service.findName({ owner: wallet.address, dseq, reader: { userId: faker.string.uuid() } })).toBeNull();
  });

  it("returns null for a deployment of the reader's that was never named", async () => {
    const wallet = createInitializedUserWallet();
    const { service, dseq } = setup({ wallet, name: null });

    expect(await service.findName({ owner: wallet.address, dseq, reader: { userId: wallet.userId } })).toBeNull();
  });

  it("returns null for a deployment Console holds no record of", async () => {
    const wallet = createInitializedUserWallet();
    const { service, dseq } = setup({ wallet, name: undefined });

    expect(await service.findName({ owner: wallet.address, dseq, reader: { userId: wallet.userId } })).toBeNull();
  });

  it("returns null without looking for a deployment when no Console wallet has the owner's address", async () => {
    const { service, deploymentSettingRepository, dseq } = setup({ wallet: undefined, name: undefined });

    expect(await service.findName({ owner: "akash1unmanaged", dseq, reader: { userId: faker.string.uuid() } })).toBeNull();
    expect(deploymentSettingRepository.findOneOfWallet).not.toHaveBeenCalled();
  });

  function setup(input: { wallet: UserWalletOutput | undefined; name: string | null | undefined }) {
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    userWalletRepository.findOneByAddress.mockResolvedValue(input.wallet);
    deploymentSettingRepository.findOneOfWallet.mockResolvedValue(input.name === undefined ? undefined : mock<DeploymentSettingsOutput>({ name: input.name }));

    const service = new DeploymentNameService(userWalletRepository, deploymentSettingRepository);

    return { service, userWalletRepository, deploymentSettingRepository, dseq: faker.string.numeric(8) };
  }
});
