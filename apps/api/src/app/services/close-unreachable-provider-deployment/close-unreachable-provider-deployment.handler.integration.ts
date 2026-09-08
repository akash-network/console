import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { CHAIN_DB } from "@src/chain";
import { JOB_NAME, JobQueueService } from "@src/core";
import { CloseUnreachableProviderDeploymentCommand } from "@src/deployment/commands/close-unreachable-provider-deployment.command";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { ProviderOutagesHttpService } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";
import { UnreachableProviderDeploymentsCloserService } from "@src/deployment/services/unreachable-provider-deployments-closer/unreachable-provider-deployments-closer.service";
import { NotificationHandler, NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { UserRepository } from "@src/user/repositories";
import { CloseUnreachableProviderDeploymentHandler } from "./close-unreachable-provider-deployment.handler";

import { createAkashAddress, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";
import { interceptNotifications } from "@test/services/notifications-intercept";

const DOWN_SINCE = "2026-07-24T00:00:00.000Z";
const UNSETTLEABLE_ESCROW = "negative decimal coin amount";

const jobWorkers = useJobWorkers(() => [container.resolve(CloseUnreachableProviderDeploymentHandler), container.resolve(NotificationHandler)]);

describe(CloseUnreachableProviderDeploymentHandler.name, () => {
  beforeAll(async () => {
    await container.resolve(CHAIN_DB).authenticate();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("closes a still fully dark deployment, records it and tells the owner", async () => {
    const { closeUnreachable, awaitClosedNotice, close, findSetting, sentNotifications, deployment } = await setup();

    await closeUnreachable();
    await awaitClosedNotice();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ address: deployment.owner }), deployment.dseq);
    expect((await findSetting())?.closed).toBe(true);
    expect(sentNotifications()).toHaveLength(1);
  });

  it("records nothing when the email it must queue alongside cannot be queued", async () => {
    const { dispatchCloseUnreachable, awaitCloseRetrying, findSetting, failNoticeEnqueue } = await setup();
    failNoticeEnqueue();

    await dispatchCloseUnreachable();
    await awaitCloseRetrying();

    expect(await findSetting()).toBeUndefined();
  });

  it("closes nothing once one of the deployment's providers answers again", async () => {
    const { closeUnreachable, close, findSetting, findClosedNotice } = await setup({ alsoOnHealthyProvider: true });

    await closeUnreachable();

    expect(close).not.toHaveBeenCalled();
    expect(await findSetting()).toBeUndefined();
    expect(await findClosedNotice()).toBeUndefined();
  });

  it("closes nothing when the deployment has no active lease left", async () => {
    const { closeUnreachable, close } = await setup({ leaseAlreadyClosed: true });

    await closeUnreachable();

    expect(close).not.toHaveBeenCalled();
  });

  it("still tells the owner when the close had already landed on chain", async () => {
    const { closeUnreachable, awaitClosedNotice, findSetting } = await setup({ alreadyClosedOnChain: true });

    await closeUnreachable();
    await awaitClosedNotice();

    expect((await findSetting())?.closed).toBe(true);
  });

  it("records nothing and tries again later when the escrow cannot be settled", async () => {
    const { closeUnreachable, close, findSetting, findClosedNotice, findPendingCloseJob } = await setup();
    close.mockRejectedValue(new Error(`failed to execute message: ${UNSETTLEABLE_ESCROW}`));

    await closeUnreachable();

    expect(await findSetting()).toBeUndefined();
    expect(await findClosedNotice()).toBeUndefined();
    expect(await findPendingCloseJob()).toBeDefined();
  });

  async function setup(input: { alsoOnHealthyProvider?: boolean; leaseAlreadyClosed?: boolean; alreadyClosedOnChain?: boolean } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const userWalletRepository = container.resolve(UserWalletRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

    const owner = createAkashAddress();
    const user = await container.resolve(UserRepository).create({ userId: faker.string.uuid(), email: "owner@example.com" });
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
    const sentNotifications = interceptNotifications();
    const commandKey = UnreachableProviderDeploymentsCloserService.singletonKey({ owner, dseq: deployment.dseq });
    const noticeKey = `notification.providerUnreachableClosed.${deployment.dseq}.${wallet.id}`;

    return {
      deployment,
      close,
      sentNotifications,
      findSetting: () => deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq }),
      findClosedNotice: async () => (await findJobRows(NotificationJob[JOB_NAME], { singletonKey: noticeKey }))[0],
      findPendingCloseJob: async () =>
        (await findJobRows(CloseUnreachableProviderDeploymentCommand[JOB_NAME], { singletonKey: commandKey, state: "created" }))[0],
      awaitClosedNotice: () => expectJobCompleted(NotificationJob[JOB_NAME], { singletonKey: noticeKey }),
      failNoticeEnqueue: () => {
        const jobQueue = container.resolve(JobQueueService);
        const passThrough = jobQueue.enqueue.bind(jobQueue);
        vi.spyOn(jobQueue, "enqueue").mockImplementation((job, options) =>
          job.name === NotificationJob[JOB_NAME] ? Promise.reject(new Error("queue unavailable")) : passThrough(job, options)
        );
      },
      awaitCloseRetrying: () =>
        vi.waitFor(
          async () => {
            const [row] = await findJobRows(CloseUnreachableProviderDeploymentCommand[JOB_NAME], { singletonKey: commandKey });
            expect(row?.state).toBe("retry");
          },
          { timeout: 20_000, interval: 250 }
        ),
      dispatchCloseUnreachable: async () => {
        await enqueue(new CloseUnreachableProviderDeploymentCommand({ owner, dseq: deployment.dseq }), { singletonKey: commandKey });
        await startWorkers();
      },
      closeUnreachable: async () => {
        await enqueue(new CloseUnreachableProviderDeploymentCommand({ owner, dseq: deployment.dseq }), { singletonKey: commandKey });
        await startWorkers();
        await expectJobCompleted(CloseUnreachableProviderDeploymentCommand[JOB_NAME], { singletonKey: commandKey, state: "completed" });
      }
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
