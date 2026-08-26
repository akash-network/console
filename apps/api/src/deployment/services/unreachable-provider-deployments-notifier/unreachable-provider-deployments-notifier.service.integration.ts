import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { CHAIN_DB } from "@src/chain";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { UserRepository } from "@src/user/repositories";
import { ProviderOutagesHttpService } from "../provider-outages-http/provider-outages-http.service";
import { UnreachableProviderDeploymentsNotifierService } from "./unreachable-provider-deployments-notifier.service";

import { createAkashAddress, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";

const DOWN_SINCE = "2026-07-24T00:00:00.000Z";
const SECOND_OUTAGE_SINCE = "2026-08-20T00:00:00.000Z";

describe(UnreachableProviderDeploymentsNotifierService.name, () => {
  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emails the owner once and remembers the outage it reported", async () => {
    const { service, createNotification, deploymentSettingRepository, deployment, user } = await setup();

    const result = await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(result.ok).toBe(true);
    expect(createNotification).toHaveBeenCalledTimes(1);
    const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq });
    expect(setting?.providerUnreachableNotifiedFor?.toISOString()).toBe(DOWN_SINCE);
  });

  it("stays quiet while the same outage drags on", async () => {
    const { service, createNotification } = await setup();

    await service.notifyUnreachableProviderDeployments({ dryRun: false });
    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it("emails again when the provider recovers and goes dark a second time", async () => {
    const { service, createNotification, setOutageStart } = await setup();
    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    setOutageStart(SECOND_OUTAGE_SINCE);
    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(createNotification).toHaveBeenCalledTimes(2);
  });

  it("retries on the next sweep when the email is rejected", async () => {
    const { service, createNotification } = await setup();
    createNotification.mockRejectedValueOnce(new Error("novu is down"));

    const failed = await service.notifyUnreachableProviderDeployments({ dryRun: false });
    const retried = await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(failed.err).toBe(true);
    expect(retried.ok).toBe(true);
    expect(createNotification).toHaveBeenCalledTimes(2);
  });

  it("leaves a self-custody deployment alone", async () => {
    const { service, createNotification } = await setup({ managed: false });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(createNotification).not.toHaveBeenCalled();
  });

  it("writes nothing on a dry run", async () => {
    const { service, createNotification, deploymentSettingRepository, deployment, user } = await setup();

    await service.notifyUnreachableProviderDeployments({ dryRun: true });

    expect(createNotification).not.toHaveBeenCalled();
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq })).toBeUndefined();
  });

  async function setup(input: { managed?: boolean } = {}) {
    const userRepository = container.resolve(UserRepository);
    const userWalletRepository = container.resolve(UserWalletRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

    const owner = createAkashAddress();
    const user = await userRepository.create({ userId: faker.string.uuid(), email: "owner@example.com" });

    if (input.managed !== false) {
      const { wallet } = await userWalletRepository.getOrCreate({ userId: user.id });
      await userWalletRepository.updateById(wallet.id, { address: owner });
    }

    const provider = await createProvider();
    const deployment = await createDeployment({ owner, dseq: faker.string.numeric(10) });
    const group = await createDeploymentGroup({ deploymentId: deployment.id, owner, dseq: deployment.dseq, gseq: 1 });
    await createLease({
      deploymentId: deployment.id,
      deploymentGroupId: group.id,
      owner,
      dseq: deployment.dseq,
      gseq: 1,
      oseq: 1,
      providerAddress: provider.owner,
      closedHeight: undefined
    });

    let startedAt = DOWN_SINCE;
    const providerOutagesHttpService = container.resolve(ProviderOutagesHttpService);
    vi.spyOn(providerOutagesHttpService, "findOutagesOlderThanDays").mockImplementation(async () => [
      { provider: provider.owner, hostUri: provider.hostUri, startedAt }
    ]);

    const createNotification = vi.spyOn(container.resolve(NotificationService), "createNotification").mockResolvedValue(undefined);

    return {
      service: container.resolve(UnreachableProviderDeploymentsNotifierService),
      deploymentSettingRepository,
      createNotification,
      deployment,
      user,
      setOutageStart: (value: string) => {
        startedAt = value;
      }
    };
  }
});
