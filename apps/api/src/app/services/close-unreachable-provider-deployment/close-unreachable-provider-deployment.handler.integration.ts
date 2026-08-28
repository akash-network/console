import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { CHAIN_DB } from "@src/chain";
import { JobQueueService } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { ProviderOutagesHttpService } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";
import { UserRepository } from "@src/user/repositories";
import { CloseUnreachableProviderDeploymentHandler } from "./close-unreachable-provider-deployment.handler";

import { createAkashAddress, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";

const DOWN_SINCE = "2026-07-24T00:00:00.000Z";

describe(CloseUnreachableProviderDeploymentHandler.name, () => {
  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("closes a still fully dark deployment, records it and tells the owner", async () => {
    const { handler, close, enqueue, deploymentSettingRepository, deployment, user } = await setup();

    await handler.handle({ owner: deployment.owner, dseq: deployment.dseq, version: 1 });

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ address: deployment.owner }), deployment.dseq);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq });
    expect(setting?.closed).toBe(true);
  });

  it("closes nothing once one of the deployment's providers answers again", async () => {
    const { handler, close, enqueue, deploymentSettingRepository, deployment, user } = await setup({ alsoOnHealthyProvider: true });

    await handler.handle({ owner: deployment.owner, dseq: deployment.dseq, version: 1 });

    expect(close).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq })).toBeUndefined();
  });

  it("closes nothing when the deployment has no active lease left", async () => {
    const { handler, close, deployment } = await setup({ leaseAlreadyClosed: true });

    await handler.handle({ owner: deployment.owner, dseq: deployment.dseq, version: 1 });

    expect(close).not.toHaveBeenCalled();
  });

  it("still tells the owner when the close had already landed on chain", async () => {
    const { handler, enqueue, deploymentSettingRepository, deployment, user } = await setup({ alreadyClosedOnChain: true });

    await handler.handle({ owner: deployment.owner, dseq: deployment.dseq, version: 1 });

    expect(enqueue).toHaveBeenCalledTimes(1);
    const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq });
    expect(setting?.closed).toBe(true);
  });

  async function setup(input: { alsoOnHealthyProvider?: boolean; leaseAlreadyClosed?: boolean; alreadyClosedOnChain?: boolean } = {}) {
    const userRepository = container.resolve(UserRepository);
    const userWalletRepository = container.resolve(UserWalletRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

    const owner = createAkashAddress();
    const user = await userRepository.create({ userId: faker.string.uuid(), email: "owner@example.com" });
    const { wallet } = await userWalletRepository.getOrCreate({ userId: user.id });
    await userWalletRepository.updateById(wallet.id, { address: owner });

    const darkProvider = await createProvider();
    const deployment = await createDeployment({ owner, dseq: faker.string.numeric(10) });
    await seedLease(deployment, darkProvider.owner, 1, input.leaseAlreadyClosed ? 10_000 : undefined);

    if (input.alsoOnHealthyProvider) {
      const healthyProvider = await createProvider();
      await seedLease(deployment, healthyProvider.owner, 2);
    }

    vi.spyOn(container.resolve(ProviderOutagesHttpService), "findOutagesOlderThanDays").mockResolvedValue([
      { provider: darkProvider.owner, hostUri: darkProvider.hostUri, startedAt: DOWN_SINCE }
    ]);

    const close = vi.spyOn(container.resolve(DeploymentWriterService), "close").mockResolvedValue(!input.alreadyClosedOnChain);
    const enqueue = vi.spyOn(container.resolve(JobQueueService), "enqueue").mockResolvedValue("job-id");

    return {
      handler: container.resolve(CloseUnreachableProviderDeploymentHandler),
      deploymentSettingRepository,
      close,
      enqueue,
      deployment,
      user
    };
  }
});

async function seedLease(deployment: { id: string; owner: string; dseq: string }, providerAddress: string, gseq: number, closedHeight?: number) {
  const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: deployment.owner, dseq: deployment.dseq, gseq });

  await createLease({
    deploymentId: deployment.id,
    deploymentGroupId: group.id,
    owner: deployment.owner,
    dseq: deployment.dseq,
    gseq,
    oseq: 1,
    providerAddress,
    closedHeight
  });
}
