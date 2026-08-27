import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { CHAIN_DB } from "@src/chain";
import { JobQueueService } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { UserRepository } from "@src/user/repositories";
import { ProviderOutagesHttpService } from "../provider-outages-http/provider-outages-http.service";
import { UnreachableProviderDeploymentsCloserService } from "./unreachable-provider-deployments-closer.service";

import { createAkashAddress, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";

const DOWN_SINCE = "2026-07-24T00:00:00.000Z";

describe(UnreachableProviderDeploymentsCloserService.name, () => {
  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes a fully dark deployment, records it and tells the owner", async () => {
    const { service, close, enqueue, deploymentSettingRepository, deployment, user } = await setup();

    const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ address: deployment.owner }), deployment.dseq);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq });
    expect(setting?.closed).toBe(true);
  });

  it("leaves the deployment alone on a second sweep", async () => {
    const { service, close } = await setup();

    await service.closeUnreachableProviderDeployments({ dryRun: false });
    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("leaves a deployment with a surviving lease on a healthy provider alone", async () => {
    const { service, close } = await setup({ alsoOnHealthyProvider: true });

    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(close).not.toHaveBeenCalled();
  });

  it("writes nothing on a dry run", async () => {
    const { service, close, enqueue, deploymentSettingRepository, deployment, user } = await setup();

    await service.closeUnreachableProviderDeployments({ dryRun: true });

    expect(close).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq })).toBeUndefined();
  });

  async function setup(input: { alsoOnHealthyProvider?: boolean } = {}) {
    const userRepository = container.resolve(UserRepository);
    const userWalletRepository = container.resolve(UserWalletRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

    const owner = createAkashAddress();
    const user = await userRepository.create({ userId: faker.string.uuid(), email: "owner@example.com" });
    const { wallet } = await userWalletRepository.getOrCreate({ userId: user.id });
    await userWalletRepository.updateById(wallet.id, { address: owner });

    const darkProvider = await createProvider();
    const deployment = await createDeployment({ owner, dseq: faker.string.numeric(10) });
    await seedLease(deployment, darkProvider.owner, 1);

    if (input.alsoOnHealthyProvider) {
      const healthyProvider = await createProvider();
      await seedLease(deployment, healthyProvider.owner, 2);
    }

    const providerOutagesHttpService = container.resolve(ProviderOutagesHttpService);
    vi.spyOn(providerOutagesHttpService, "findOutagesOlderThanDays").mockResolvedValue([
      { provider: darkProvider.owner, hostUri: darkProvider.hostUri, startedAt: DOWN_SINCE }
    ]);

    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(true);
    const enqueue = vi.spyOn(container.resolve(JobQueueService), "enqueue").mockResolvedValue("job-id");

    return {
      service: container.resolve(UnreachableProviderDeploymentsCloserService),
      deploymentSettingRepository,
      close,
      enqueue,
      deployment,
      user
    };
  }
});

async function seedLease(deployment: { id: string; owner: string; dseq: string }, providerAddress: string, gseq: number) {
  const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: deployment.owner, dseq: deployment.dseq, gseq });

  await createLease({
    deploymentId: deployment.id,
    deploymentGroupId: group.id,
    owner: deployment.owner,
    dseq: deployment.dseq,
    gseq,
    oseq: 1,
    providerAddress,
    closedHeight: undefined
  });
}
