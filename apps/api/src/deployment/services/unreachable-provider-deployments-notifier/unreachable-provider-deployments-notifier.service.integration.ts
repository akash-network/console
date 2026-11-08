import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { CHAIN_DB } from "@src/chain";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { TeamRecordRetentionService } from "@src/user/services/team-record-retention/team-record-retention.service";
import { ProviderOutagesHttpService } from "../provider-outages-http/provider-outages-http.service";
import { UnreachableProviderDeploymentsNotifierService } from "./unreachable-provider-deployments-notifier.service";

import { createAkashAddress, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

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

  it("warns the member who filed a team deployment while they still belong to the team", async () => {
    const { service, createNotification, user } = await setup({ inTeam: true });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(createNotification.mock.calls.map(([{ user }]) => user.id)).toEqual([user.id]);
  });

  it("warns every owner of a team the filer has left, and remembers the outage on the filer's record", async () => {
    const { service, createNotification, deploymentSettingRepository, deployment, user, teamOwners } = await setup({
      inTeam: true,
      filerLeftTeam: true,
      teamOwnerCount: 2
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(createNotification.mock.calls.map(([{ user }]) => user.id).sort()).toEqual(teamOwners.map(({ id }) => id).sort());
    const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: deployment.dseq });
    expect(setting?.providerUnreachableNotifiedFor?.toISOString()).toBe(DOWN_SINCE);
  });

  it("warns every owner of a team whose filer deleted their account once, and remembers the outage on the team's record", async () => {
    const { service, createNotification, findTeamSetting, teamOwners } = await setup({
      inTeam: true,
      filerDeletedAccount: true,
      teamOwnerCount: 2
    });

    await service.notifyUnreachableProviderDeployments({ dryRun: false });
    await service.notifyUnreachableProviderDeployments({ dryRun: false });

    expect(createNotification.mock.calls.map(([{ user }]) => user.id).sort()).toEqual(teamOwners.map(({ id }) => id).sort());
    const setting = await findTeamSetting();
    expect(setting).toMatchObject({ userId: null });
    expect(setting?.providerUnreachableNotifiedFor?.toISOString()).toBe(DOWN_SINCE);
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

  async function setup(input: { managed?: boolean; inTeam?: boolean; filerLeftTeam?: boolean; filerDeletedAccount?: boolean; teamOwnerCount?: number } = {}) {
    const userRepository = container.resolve(UserRepository);
    const userWalletRepository = container.resolve(UserWalletRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

    const owner = createAkashAddress();
    const user = await userRepository.create({ userId: faker.string.uuid(), email: "owner@example.com" });
    const team = input.inTeam
      ? await seedTeamWallet(owner, { memberId: input.filerLeftTeam ? undefined : user.id, ownerCount: input.teamOwnerCount ?? 1 })
      : undefined;

    if (!team && input.managed !== false) {
      const { wallet } = await userWalletRepository.getOrCreate({ userId: user.id });
      await userWalletRepository.updateById(wallet.id, { address: owner });
    }

    const provider = await createProvider();
    const deployment = await createDeployment({ owner, dseq: faker.string.numeric(10) });

    const teamSetting = team && (await seedDeploymentSetting({ userId: user.id, organizationId: team.organizationId, dseq: deployment.dseq }));

    if (input.filerDeletedAccount) {
      await deleteAccount(user);
    }
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
      findTeamSetting: async () => teamSetting && (await deploymentSettingRepository.findById(teamSetting.id)),
      teamOwners: team?.owners ?? [],
      setOutageStart: (value: string) => {
        startedAt = value;
      }
    };
  }
});

async function deleteAccount(user: UserOutput) {
  await container.resolve(TeamRecordRetentionService).releaseFromTeams(user);
  await container.resolve(UserRepository).deleteById(user.id);
}

async function seedTeamWallet(address: string, { memberId, ownerCount }: { memberId?: string; ownerCount: number }) {
  const { organization, user: firstOwner } = await seedOrganizationWithOwner({ user: { email: faker.internet.email() } });
  const owners = [firstOwner];

  while (owners.length < ownerCount) {
    const owner = await seedUser({ email: faker.internet.email() });
    await seedOrganizationMember({ organizationId: organization.id, userId: owner.id, role: "owner" });
    owners.push(owner);
  }

  if (memberId) {
    await seedOrganizationMember({ organizationId: organization.id, userId: memberId });
  }

  await container
    .resolve<ApiPgDatabase>(POSTGRES_DB)
    .insert(resolveTable("UserWallets"))
    .values({ userId: null, organizationId: organization.id, address, isTrialing: false });

  return { organizationId: organization.id, owners };
}
