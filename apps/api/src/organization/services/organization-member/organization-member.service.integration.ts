import { and, eq } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { UserOutput } from "@src/user/repositories";
import { LAST_OWNER_ERROR_CODE, OrganizationMemberService, OWNER_ROLE_RESTRICTED_ERROR_CODE } from "./organization-member.service";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(OrganizationMemberService.name, () => {
  describe("assertAnotherOwnerRemains", () => {
    it("lets exactly one of two concurrent demotions of the last two owners through", async () => {
      const { service, repository, txService, organization, owners } = await setup();

      const outcomes = await Promise.allSettled(
        owners.map(owner =>
          txService.transaction(async () => {
            await service.assertAnotherOwnerRemains(organization.id, owner.membership.userId);
            await delay(100);
            await repository.updateBy({ organizationId: organization.id, userId: owner.membership.userId }, { role: "member" });
          })
        )
      );

      expect(outcomes.map(outcome => outcome.status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(outcomes.find(outcome => outcome.status === "rejected")).toMatchObject({
        reason: expect.objectContaining({ status: 409, errorCode: LAST_OWNER_ERROR_CODE })
      });
      expect(await repository.count({ organizationId: organization.id, role: "owner" })).toBe(1);
    });

    it("lets an owner step down while another owner stays", async () => {
      const { service, repository, txService, organization, owners } = await setup();

      await txService.transaction(async () => {
        await service.assertAnotherOwnerRemains(organization.id, owners[0].membership.userId);
        await repository.updateBy({ organizationId: organization.id, userId: owners[0].membership.userId }, { role: "member" });
      });

      expect(await repository.count({ organizationId: organization.id, role: "owner" })).toBe(1);
    });

    it("refuses to let the last owner step down", async () => {
      const { service, repository, txService, organization, owners } = await setup();
      await repository.updateBy({ organizationId: organization.id, userId: owners[0].membership.userId }, { role: "member" });

      await expect(txService.transaction(() => service.assertAnotherOwnerRemains(organization.id, owners[1].membership.userId))).rejects.toMatchObject({
        status: 409,
        errorCode: LAST_OWNER_ERROR_CODE
      });
    });
  });

  describe("updateRole", () => {
    it("keeps the last owner when the last two owners step down at the same time", async () => {
      const { service, repository, txService, organization, owners, runAs } = await setup();

      const first = txService.transaction(async () => {
        await runAs(owners[0].user, "owner", () => service.updateRole(owners[0].membership.id, "admin"));
        await delay(200);
      });
      await delay(50);
      const second = runAs(owners[1].user, "owner", () => service.updateRole(owners[1].membership.id, "admin"));

      await expect(first).resolves.toBeUndefined();
      await expect(second).rejects.toMatchObject({ status: 409, errorCode: LAST_OWNER_ERROR_CODE });
      expect(await repository.findById(owners[1].membership.id)).toMatchObject({ role: "owner" });
      expect(await repository.count({ organizationId: organization.id, role: "owner" })).toBe(1);
    });

    it("keeps an owner when the last two owners demote each other at the same time", async () => {
      const { service, repository, txService, organization, owners, runAs } = await setup();

      const first = txService.transaction(async () => {
        await runAs(owners[0].user, "owner", () => service.updateRole(owners[1].membership.id, "admin"));
        await delay(200);
      });
      await delay(50);
      const second = runAs(owners[1].user, "owner", () => service.updateRole(owners[0].membership.id, "admin"));

      await expect(first).resolves.toBeUndefined();
      await expect(second).rejects.toMatchObject({ status: 403, errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
      expect(await repository.findById(owners[0].membership.id)).toMatchObject({ role: "owner" });
      expect(await repository.count({ organizationId: organization.id, role: "owner" })).toBe(1);
    });

    it("refuses to let an admin promote a member to owner", async () => {
      const { service, repository, organization, runAs } = await setup();
      const [admin, member] = await Promise.all([seedUser(), seedUser()]);
      await seedOrganizationMember({ organizationId: organization.id, userId: admin.id, role: "admin" });
      const membership = await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" });

      await expect(runAs(admin, "admin", () => service.updateRole(membership.id, "owner"))).rejects.toMatchObject({
        status: 403,
        errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE
      });
      expect(await repository.findById(membership.id)).toMatchObject({ role: "member" });
    });
  });

  describe("removeMember", () => {
    it("keeps an owner when the last two owners remove each other at the same time", async () => {
      const { service, repository, txService, organization, owners, runAs } = await setup();

      const first = txService.transaction(async () => {
        await runAs(owners[0].user, "owner", () => service.removeMember(owners[1].membership.id));
        await delay(200);
      });
      await delay(50);
      const second = runAs(owners[1].user, "owner", () => service.removeMember(owners[0].membership.id));

      await expect(first).resolves.toBeUndefined();
      await expect(second).rejects.toMatchObject({ status: 403, errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
      expect(await repository.find({ organizationId: organization.id })).toEqual([expect.objectContaining({ id: owners[0].membership.id, role: "owner" })]);
    });

    it("drops the removed member's project grants and leaves their deployments with the organization", async () => {
      const { service, repository, organization, project, owners, runAs } = await setup();
      const member = await seedUser();
      const membership = await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" });
      await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id });
      const deployment = await seedDeploymentSetting({ userId: member.id, organizationId: organization.id, projectId: project.id });

      await runAs(owners[0].user, "owner", () => service.removeMember(membership.id));

      const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
      const ProjectMembers = resolveTable("ProjectMembers");
      const DeploymentSettings = resolveTable("DeploymentSettings");
      expect(await repository.findById(membership.id)).toBeUndefined();
      expect(
        await db
          .select()
          .from(ProjectMembers)
          .where(and(eq(ProjectMembers.organizationId, organization.id), eq(ProjectMembers.userId, member.id)))
      ).toEqual([]);
      expect(await db.select().from(DeploymentSettings).where(eq(DeploymentSettings.id, deployment.id))).toEqual([
        expect.objectContaining({ userId: member.id, organizationId: organization.id, projectId: project.id })
      ]);
    });
  });

  describe("transferOwnership", () => {
    it("hands ownership to the member and steps the caller down to admin", async () => {
      const { service, repository, organization, owners, runAs } = await setup();
      await repository.updateBy({ id: owners[1].membership.id }, { role: "member" });

      const transferred = await runAs(owners[0].user, "owner", () => service.transferOwnership(owners[1].membership.id));

      expect(transferred).toMatchObject({ id: owners[1].membership.id, role: "owner", username: owners[1].user.username, email: owners[1].user.email });
      expect(await repository.findById(owners[0].membership.id)).toMatchObject({ role: "admin" });
      expect(await repository.count({ organizationId: organization.id, role: "owner" })).toBe(1);
    });
  });

  async function setup() {
    const service = container.resolve(OrganizationMemberService);
    const repository = container.resolve(OrganizationMemberRepository);
    const txService = container.resolve(TxService);
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);
    const { organization, project, user: firstUser, membership: first } = await seedOrganizationWithOwner();
    const secondUser = await seedUser();
    const second = await seedOrganizationMember({ organizationId: organization.id, userId: secondUser.id, role: "owner" });

    function runAs<R>(user: UserOutput, role: OrganizationRole, act: () => Promise<R>) {
      return executionContextService.runWithContext(async () => {
        executionContextService.set("CURRENT_USER", user);
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId: organization.id, role }));
        executionContextService.set("ABILITY", abilityService.getAbilityFor("REGULAR_USER", user));

        return await act();
      });
    }

    return {
      service,
      repository,
      txService,
      organization,
      project,
      runAs,
      owners: [
        { user: firstUser, membership: first },
        { user: secondUser, membership: second }
      ]
    };
  }
});
