import type { AnyAbility } from "@casl/ability";
import { ForbiddenError } from "@casl/ability";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import { AbilityService } from "./ability.service";

import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganization, seedOrganizationMember, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";

describe(AbilityService.name, () => {
  describe("on deployment settings", () => {
    it("shows a member granted two of four projects the rows of exactly those two", async () => {
      const { readableIds, member, organization, projects, rowsByProject } = await setup();
      const ability = await abilityFor(member, {
        organizationId: organization.id,
        role: "member",
        projectScope: createProjectsScope([projects[0].id, projects[2].id])
      });

      expect(await readableIds(ability)).toEqual([rowsByProject[0].id, rowsByProject[2].id].sort());
    });

    it("shows a member granted no projects nothing", async () => {
      const { readableIds, member, organization } = await setup();
      const ability = await abilityFor(member, { organizationId: organization.id, role: "member", projectScope: createProjectsScope([]) });

      expect(await readableIds(ability)).toEqual([]);
    });

    it.each(["owner", "admin"] as const)("shows the %s every project of the organization without a grant", async role => {
      const { readableIds, member, organization, rowsByProject } = await setup();
      const ability = await abilityFor(member, { organizationId: organization.id, role, projectScope: { kind: "all" } });

      expect(await readableIds(ability)).toEqual(rowsByProject.map(row => row.id).sort());
    });

    it("never shows the rows of another organization", async () => {
      const { readableIds, member, otherOrganization, otherOrganizationRow } = await setup();
      const ability = await abilityFor(member, { organizationId: otherOrganization.id, role: "owner", projectScope: { kind: "all" } });

      expect(await readableIds(ability)).toEqual([otherOrganizationRow.id]);
    });

    it("lets a viewer read its projects but not change them", async () => {
      const { readableIds, repository, member, organization, projects, rowsByProject } = await setup();
      const ability = await abilityFor(member, {
        organizationId: organization.id,
        role: "viewer",
        projectScope: createProjectsScope([projects[1].id, projects[3].id])
      });

      expect(await readableIds(ability)).toEqual([rowsByProject[1].id, rowsByProject[3].id].sort());
      expect(() => repository.accessibleBy(ability, "update")).toThrow(ForbiddenError);
      expect(() => repository.accessibleBy(ability, "delete")).toThrow(ForbiddenError);
      expect(() => repository.accessibleBy(ability, "create")).toThrow(ForbiddenError);
    });

    it("lets a member create a deployment setting only in a project it was granted", async () => {
      const { repository, member, organization, projects } = await setup();
      const ability = await abilityFor(member, { organizationId: organization.id, role: "member", projectScope: createProjectsScope([projects[0].id]) });

      const created = await repository
        .accessibleBy(ability, "create")
        .create({ userId: member.id, dseq: createDseq(), organizationId: organization.id, projectId: projects[0].id });

      expect(created.projectId).toBe(projects[0].id);
      await expect(
        repository.accessibleBy(ability, "create").create({ userId: member.id, dseq: createDseq(), organizationId: organization.id, projectId: projects[1].id })
      ).rejects.toThrow(ForbiddenError);
    });

    it("keeps filtering by user in legacy mode", async () => {
      const { readableIds, member, organization, memberLegacyRow } = await setup();
      const ability = await abilityFor(member, { organizationId: organization.id, role: "owner", projectScope: { kind: "all" }, mode: "legacy" });

      expect(await readableIds(ability)).toEqual([memberLegacyRow.id]);
    });

    async function setup() {
      const repository = container.resolve(DeploymentSettingRepository);
      const owner = await seedUser();
      const member = await seedUser();
      const organization = await seedOrganization({ createdByUserId: owner.id });
      const projects = await Promise.all([1, 2, 3, 4].map(() => seedProject({ organizationId: organization.id, createdByUserId: owner.id })));
      const rowsByProject = await Promise.all(
        projects.map(project => seedDeploymentSetting({ userId: owner.id, organizationId: organization.id, projectId: project.id }))
      );
      const otherOrganization = await seedOrganization({ createdByUserId: owner.id });
      const otherProject = await seedProject({ organizationId: otherOrganization.id, createdByUserId: owner.id });
      const otherOrganizationRow = await seedDeploymentSetting({ userId: owner.id, organizationId: otherOrganization.id, projectId: otherProject.id });
      const memberLegacyRow = await seedDeploymentSetting({ userId: member.id });

      async function readableIds(ability: AnyAbility) {
        const rows = await repository.accessibleBy(ability, "read").find();
        return rows.map(row => row.id).sort();
      }

      return { readableIds, repository, member, organization, projects, rowsByProject, otherOrganization, otherOrganizationRow, memberLegacyRow };
    }
  });

  describe("on organization members", () => {
    it("lets an admin read every membership but change only those below owner", async () => {
      const { repository, admin, organization, memberships } = await setup();
      const ability = await abilityFor(admin, { organizationId: organization.id, role: "admin", projectScope: { kind: "all" } });

      const readable = await repository.accessibleBy(ability, "read").find({ organizationId: organization.id });
      const writable = await repository.accessibleBy(ability, "update").find({ organizationId: organization.id });

      expect(readable.map(row => row.id).sort()).toEqual([memberships.owner.id, memberships.admin.id, memberships.member.id].sort());
      expect(writable.map(row => row.id).sort()).toEqual([memberships.admin.id, memberships.member.id].sort());
    });

    it("keeps an admin from demoting or removing an owner", async () => {
      const { repository, admin, organization, memberships } = await setup();
      const ability = await abilityFor(admin, { organizationId: organization.id, role: "admin", projectScope: { kind: "all" } });

      await repository.accessibleBy(ability, "update").updateById(memberships.owner.id, { role: "member" });
      await repository.accessibleBy(ability, "delete").deleteById(memberships.owner.id);
      await repository.accessibleBy(ability, "update").updateById(memberships.member.id, { role: "billing" });

      expect(await repository.findById(memberships.owner.id)).toMatchObject({ role: "owner" });
      expect(await repository.findById(memberships.member.id)).toMatchObject({ role: "billing" });
    });

    it("keeps an admin from adding an owner", async () => {
      const { repository, admin, organization } = await setup();
      const ability = await abilityFor(admin, { organizationId: organization.id, role: "admin", projectScope: { kind: "all" } });
      const [newOwner, newMember] = await Promise.all([seedUser(), seedUser()]);

      await expect(repository.accessibleBy(ability, "create").create({ organizationId: organization.id, userId: newOwner.id, role: "owner" })).rejects.toThrow(
        ForbiddenError
      );
      await expect(repository.accessibleBy(ability, "create").create({ organizationId: organization.id, userId: newMember.id, role: "member" })).resolves.toMatchObject(
        { role: "member" }
      );
    });

    it("lets an owner change another owner", async () => {
      const { repository, organization, memberships, owner } = await setup();
      const coOwner = await seedUser();
      const coOwnerMembership = await seedOrganizationMember({ organizationId: organization.id, userId: coOwner.id, role: "owner" });
      const ability = await abilityFor(owner, { organizationId: organization.id, role: "owner", projectScope: { kind: "all" } });

      const writable = await repository.accessibleBy(ability, "update").find({ organizationId: organization.id });

      expect(writable.map(row => row.id).sort()).toEqual([memberships.owner.id, memberships.admin.id, memberships.member.id, coOwnerMembership.id].sort());
    });

    async function setup() {
      const repository = container.resolve(OrganizationMemberRepository);
      const [owner, admin, member] = await Promise.all([seedUser(), seedUser(), seedUser()]);
      const organization = await seedOrganization({ createdByUserId: owner.id });
      const memberships = {
        owner: await seedOrganizationMember({ organizationId: organization.id, userId: owner.id, role: "owner" }),
        admin: await seedOrganizationMember({ organizationId: organization.id, userId: admin.id, role: "admin" }),
        member: await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" })
      };

      return { repository, owner, admin, organization, memberships };
    }
  });

  async function abilityFor(user: UserOutput, context: Partial<OrganizationContext>) {
    const executionContextService = container.resolve(ExecutionContextService);

    return await executionContextService.runWithContext(async () => {
      executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext(context));
      return container.resolve(AbilityService).getAbilityFor("REGULAR_USER", user);
    });
  }
});
