import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { UserWalletRepository } from "@src/billing/repositories";
import { CHAIN_DB } from "@src/chain";
import { type ApiPgDatabase, JOB_NAME, JobQueueService, POSTGRES_DB, resolveTable } from "@src/core";
import { CloseUnreachableProviderDeploymentCommand } from "@src/deployment/commands/close-unreachable-provider-deployment.command";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { ProviderOutagesHttpService } from "@src/deployment/services/provider-outages-http/provider-outages-http.service";
import { UnreachableProviderDeploymentsCloserService } from "@src/deployment/services/unreachable-provider-deployments-closer/unreachable-provider-deployments-closer.service";
import { NotificationHandler, NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";
import { UserRepository } from "@src/user/repositories";
import { CloseUnreachableProviderDeploymentHandler } from "./close-unreachable-provider-deployment.handler";

import { createAkashAddress, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
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
    const { closeUnreachable, awaitClosedNotice, close, findSetting, sentNotifications, deployment, user } = await setup();

    await closeUnreachable();
    await awaitClosedNotice();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ address: deployment.owner }), deployment.dseq, { reason: "provider_unreachable" });
    expect((await findSetting())?.closed).toBe(true);
    expect(sentNotifications().map(({ userId }) => userId)).toEqual([user.id]);
  });

  it("tells the member who filed a team deployment while they still belong to the team, and nobody else", async () => {
    const { closeUnreachable, awaitClosedNotice, findClosedNotices, sentNotifications, user } = await setup({ inTeam: true });

    await closeUnreachable();
    await awaitClosedNotice();

    expect(sentNotifications().map(({ userId }) => userId)).toEqual([user.id]);
    expect(await findClosedNotices()).toHaveLength(1);
  });

  it("tells the team's owners instead of a filer who has left the team", async () => {
    const { closeUnreachable, awaitClosedNotice, findClosedNotices, findSetting, sentNotifications, teamOwners } = await setup({
      inTeam: true,
      filerLeftTeam: true
    });
    const [owner] = teamOwners;

    await closeUnreachable();
    await awaitClosedNotice(owner.id);

    expect(sentNotifications().map(({ userId }) => userId)).toEqual([owner.id]);
    expect(await findClosedNotices()).toHaveLength(1);
    expect((await findSetting())?.closed).toBe(true);
  });

  it("tells each owner of a team the filer has left exactly once", async () => {
    const { closeUnreachable, awaitClosedNotice, findClosedNotices, sentNotifications, teamOwners } = await setup({
      inTeam: true,
      filerLeftTeam: true,
      teamOwnerCount: 2
    });
    const ownerIds = teamOwners.map(({ id }) => id);

    await closeUnreachable();
    for (const ownerId of ownerIds) await awaitClosedNotice(ownerId);

    expect(
      sentNotifications()
        .map(({ userId }) => userId)
        .sort()
    ).toEqual([...ownerIds].sort());
    expect(await findClosedNotices()).toHaveLength(ownerIds.length);
  });

  it("records the close in the owner's feed as Console's, because the provider stopped responding", async () => {
    const { closeUnreachable, findActivities, deployment } = await setup();

    await closeUnreachable();

    expect(await findActivities()).toEqual([
      expect.objectContaining({
        type: "deployment_close",
        status: "succeeded",
        initiator: "system",
        meta: { dseq: deployment.dseq, reason: "provider_unreachable" },
        dedupeKey: deploymentCloseDedupeKeyOf({ owner: deployment.owner, dseq: deployment.dseq })
      })
    ]);
  });

  it("records a team deployment's close in the feed of the member who created it, keyed by the organization's wallet", async () => {
    const { closeUnreachable, findActivities, deployment } = await setup({ inTeam: true });

    await closeUnreachable();

    expect(await findActivities()).toEqual([
      expect.objectContaining({
        initiator: "system",
        meta: { dseq: deployment.dseq, reason: "provider_unreachable" },
        dedupeKey: deploymentCloseDedupeKeyOf({ owner: deployment.owner, dseq: deployment.dseq })
      })
    ]);
  });

  it("remembers that Console closed a deployment with no setting before the close, on the setting the close files", async () => {
    const { closeUnreachable, awaitClosedNotice, findSetting } = await setup();

    await closeUnreachable();
    await awaitClosedNotice();

    expect(await findSetting()).toMatchObject({ closed: true, consoleCloseReason: "provider_unreachable" });
  });

  it("files no close reason for a close that had already landed on chain", async () => {
    const { closeUnreachable, awaitClosedNotice, findSetting } = await setup({ alreadyClosedOnChain: true });

    await closeUnreachable();
    await awaitClosedNotice();

    expect(await findSetting()).toMatchObject({ closed: true, consoleCloseReason: null });
  });

  it("remembers on a team deployment's setting that Console closed it because its provider stopped responding", async () => {
    const { closeUnreachable, findSetting } = await setup({ inTeam: true });

    await closeUnreachable();

    expect(await findSetting()).toMatchObject({ closed: true, consoleCloseReason: "provider_unreachable" });
  });

  it("adds nothing to the feed when the close had already landed on chain", async () => {
    const { closeUnreachable, awaitClosedNotice, findActivities } = await setup({ alreadyClosedOnChain: true });

    await closeUnreachable();
    await awaitClosedNotice();

    expect(await findActivities()).toEqual([]);
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
    const { closeUnreachable, close, findSetting, findClosedNotice, findPendingCloseJob, findActivities } = await setup();
    close.mockRejectedValue(new Error(`failed to execute message: ${UNSETTLEABLE_ESCROW}`));

    await closeUnreachable();

    expect(await findSetting()).toBeUndefined();
    expect(await findClosedNotice()).toBeUndefined();
    expect(await findPendingCloseJob()).toBeDefined();
    expect(await findActivities()).toEqual([]);
  });

  async function setup(
    input: {
      alsoOnHealthyProvider?: boolean;
      leaseAlreadyClosed?: boolean;
      alreadyClosedOnChain?: boolean;
      inTeam?: boolean;
      filerLeftTeam?: boolean;
      teamOwnerCount?: number;
    } = {}
  ) {
    const { enqueue, startWorkers } = await jobWorkers();
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

    const owner = createAkashAddress();
    const user = await container.resolve(UserRepository).create({ userId: faker.string.uuid(), email: "owner@example.com" });
    const { wallet, teamOwners } = input.inTeam
      ? await seedTeamWallet(owner, { memberId: input.filerLeftTeam ? undefined : user.id, ownerCount: input.teamOwnerCount ?? 1 })
      : { wallet: await seedPersonalWallet(user.id, owner), teamOwners: [] };

    const darkProvider = await createProvider();
    const deployment = await createDeployment({ owner, dseq: faker.string.numeric(10) });

    if (input.inTeam) {
      await seedDeploymentSetting({ userId: user.id, organizationId: wallet.organizationId, dseq: deployment.dseq });
    }
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
    const noticeKeyPrefix = `notification.providerUnreachableClosed.${deployment.dseq}.${wallet.id}`;
    const findClosedNotices = () => findJobRows(NotificationJob[JOB_NAME], { singletonKeyLike: `${noticeKeyPrefix}.%` });

    return {
      deployment,
      user,
      teamOwners,
      close,
      sentNotifications,
      findSetting: () => deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq }),
      findActivities: () => container.resolve(ActivityRepository).find({ userId: user.id }),
      findClosedNotices,
      findClosedNotice: async () => (await findClosedNotices())[0],
      findPendingCloseJob: async () =>
        (await findJobRows(CloseUnreachableProviderDeploymentCommand[JOB_NAME], { singletonKey: commandKey, state: "created" }))[0],
      awaitClosedNotice: (recipientId: string = user.id) =>
        expectJobCompleted(NotificationJob[JOB_NAME], { singletonKey: `${noticeKeyPrefix}.${recipientId}` }),
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

async function seedPersonalWallet(userId: string, address: string) {
  const userWalletRepository = container.resolve(UserWalletRepository);
  const { wallet } = await userWalletRepository.getOrCreate({ userId });
  await userWalletRepository.updateById(wallet.id, { address });

  return wallet;
}

async function seedTeamWallet(address: string, { memberId, ownerCount }: { memberId?: string; ownerCount: number }) {
  const { organization, user: firstOwner } = await seedOrganizationWithOwner({ user: { email: faker.internet.email() } });
  const teamOwners = [firstOwner];

  while (teamOwners.length < ownerCount) {
    const owner = await seedUser({ email: faker.internet.email() });
    await seedOrganizationMember({ organizationId: organization.id, userId: owner.id, role: "owner" });
    teamOwners.push(owner);
  }

  if (memberId) {
    await seedOrganizationMember({ organizationId: organization.id, userId: memberId });
  }

  const [wallet] = await container
    .resolve<ApiPgDatabase>(POSTGRES_DB)
    .insert(resolveTable("UserWallets"))
    .values({ userId: null, organizationId: organization.id, address, isTrialing: false })
    .returning();

  return { wallet, teamOwners };
}

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
