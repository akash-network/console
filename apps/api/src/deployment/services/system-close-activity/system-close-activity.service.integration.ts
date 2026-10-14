import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SystemCloseActivityService } from "./system-close-activity.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(SystemCloseActivityService.name, () => {
  it("records a team deployment's close in the feed of the member who filed it, keyed by the team wallet", async () => {
    const { service, member, teamWallet, dseq, activitiesOf } = await setup();
    await seedDeploymentSetting({ userId: member.id, organizationId: teamWallet.organizationId, dseq });

    await service.record({ wallet: teamWallet, dseq, reason: "runtime_limit_reached" });

    expect(await activitiesOf(member.id)).toEqual([
      expect.objectContaining({
        status: "succeeded",
        initiator: "system",
        meta: { dseq, reason: "runtime_limit_reached" },
        dedupeKey: deploymentCloseDedupeKeyOf({ owner: teamWallet.address, dseq })
      })
    ]);
  });

  it("records a personal deployment's close in its user's feed", async () => {
    const { service, member, personalWallet, dseq, activitiesOf } = await setup();
    await seedDeploymentSetting({ userId: member.id, organizationId: personalWallet.organizationId, dseq });

    await service.record({ wallet: personalWallet, dseq, reason: "no_lease" });

    expect(await activitiesOf(member.id)).toEqual([
      expect.objectContaining({ meta: { dseq, reason: "no_lease" }, dedupeKey: deploymentCloseDedupeKeyOf({ owner: personalWallet.address, dseq }) })
    ]);
  });

  it("records the closes of a personal and a team deployment that share a dseq as two entries, since each wallet owns its own", async () => {
    const { service, member, personalWallet, teamWallet, dseq, activitiesOf } = await setup();
    await seedDeploymentSetting({ userId: member.id, organizationId: teamWallet.organizationId, dseq });

    await service.record({ wallet: personalWallet, dseq, reason: "no_lease" });
    await service.record({ wallet: teamWallet, dseq, reason: "runtime_limit_reached" });

    expect(await activitiesOf(member.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ meta: { dseq, reason: "no_lease" }, dedupeKey: deploymentCloseDedupeKeyOf({ owner: personalWallet.address, dseq }) }),
        expect.objectContaining({ meta: { dseq, reason: "runtime_limit_reached" }, dedupeKey: deploymentCloseDedupeKeyOf({ owner: teamWallet.address, dseq }) })
      ])
    );
    expect(await activitiesOf(member.id)).toHaveLength(2);
  });

  it("records a deployment's close once when reported twice", async () => {
    const { service, member, teamWallet, dseq, activitiesOf } = await setup();
    await seedDeploymentSetting({ userId: member.id, organizationId: teamWallet.organizationId, dseq });

    await service.record({ wallet: teamWallet, dseq, reason: "provider_unreachable" });
    await service.record({ wallet: teamWallet, dseq, reason: "no_lease" });

    expect(await activitiesOf(member.id)).toEqual([expect.objectContaining({ meta: { dseq, reason: "provider_unreachable" } })]);
  });

  it("records nothing for a team deployment Console holds no record of", async () => {
    const { service, member, teamWallet, dseq, activitiesOf } = await setup();

    await service.record({ wallet: teamWallet, dseq, reason: "no_lease" });

    expect(await activitiesOf(member.id)).toEqual([]);
  });

  it("records nothing for a team deployment whose member deleted their account", async () => {
    const { service, member, teamWallet, dseq, activitiesOf } = await setup();
    const setting = await seedDeploymentSetting({ userId: member.id, organizationId: teamWallet.organizationId, dseq });
    await container.resolve(DeploymentSettingRepository).unscoped("account-deletion").updateById(setting.id, { userId: null });

    await service.record({ wallet: teamWallet, dseq, reason: "no_lease" });

    expect(await activitiesOf(member.id)).toEqual([]);
  });

  async function setup() {
    const service = container.resolve(SystemCloseActivityService);
    const member = await seedUser();
    const personal = await seedOrganization({ type: "personal", createdByUserId: member.id });
    const { organization: team } = await seedOrganizationWithOwner();
    await seedOrganizationMember({ organizationId: team.id, userId: member.id });

    return {
      service,
      member,
      dseq: createDseq(),
      personalWallet: { userId: member.id, organizationId: personal.id, address: createAkashAddress() },
      teamWallet: { userId: null, organizationId: team.id, address: createAkashAddress() },
      activitiesOf: (userId: string) => container.resolve(ActivityRepository).find({ userId })
    };
  }
});
