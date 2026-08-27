import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { CHAIN_DB } from "@src/chain";
import { JobQueueService } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
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

  it("hands a fully dark deployment to its own close job", async () => {
    const { service, enqueue, deployment } = await setup();

    const result = await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: { owner: deployment.owner, dseq: deployment.dseq } }), {
      singletonKey: `CloseUnreachableProviderDeploymentCommand.${deployment.owner}.${deployment.dseq}`
    });
  });

  it("leaves a deployment with a surviving lease on a healthy provider alone", async () => {
    const { service, enqueue } = await setup({ alsoOnHealthyProvider: true });

    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it("schedules nothing on a dry run", async () => {
    const { service, enqueue, deploymentSettingRepository, deployment, user } = await setup();

    await service.closeUnreachableProviderDeployments({ dryRun: true });

    expect(enqueue).not.toHaveBeenCalled();
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq })).toBeUndefined();
  });

  it("leaves a deployment already recorded as closed alone", async () => {
    const { service, enqueue, deploymentSettingRepository, deployment, user } = await setup();
    await deploymentSettingRepository.markClosed({ userId: user.id, dseq: deployment.dseq });

    await service.closeUnreachableProviderDeployments({ dryRun: false });

    expect(enqueue).not.toHaveBeenCalled();
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

    const jobQueueService = container.resolve(JobQueueService);
    const enqueue = vi.spyOn(jobQueueService, "enqueue").mockResolvedValue("job-id");
    vi.spyOn(jobQueueService, "findPendingSingletonKeys").mockResolvedValue(new Set());

    return {
      service: container.resolve(UnreachableProviderDeploymentsCloserService),
      deploymentSettingRepository,
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
