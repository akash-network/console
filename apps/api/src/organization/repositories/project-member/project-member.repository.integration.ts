import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import { ProjectMemberRepository } from "./project-member.repository";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";

describe(ProjectMemberRepository.name, () => {
  describe("createUnlessExists", () => {
    it("keeps a single grant when the same access is granted twice at once", async () => {
      const { repository, txService, organization, project, member } = await setup();
      const grant = { organizationId: organization.id, projectId: project.id, userId: member.id };

      const results = await Promise.all([
        txService.transaction(() => repository.createUnlessExists({ ...grant, role: "member" })),
        txService.transaction(() => repository.createUnlessExists({ ...grant, role: "viewer" }))
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await grantRowsOf(member.id)).toEqual([expect.objectContaining({ ...grant, role: results.find(Boolean)?.role })]);
    });

    it("grants the same user several projects", async () => {
      const { repository, organization, project, member } = await setup();
      const other = await seedProject({ organizationId: organization.id });

      await repository.createUnlessExists({ organizationId: organization.id, projectId: project.id, userId: member.id, role: "member" });
      await repository.createUnlessExists({ organizationId: organization.id, projectId: other.id, userId: member.id, role: "viewer" });

      expect(await grantRowsOf(member.id)).toHaveLength(2);
    });
  });

  describe("findOfLiveProjects", () => {
    it("returns the grants of a project with the grantee's username and email, oldest first", async () => {
      const { repository, organization, project, member } = await setup();
      const colleague = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email() });
      await seedOrganizationMember({ organizationId: organization.id, userId: colleague.id, role: "viewer" });
      const first = await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id, createdAt: new Date("2026-01-01") });
      const second = await seedProjectMember({
        organizationId: organization.id,
        projectId: project.id,
        userId: colleague.id,
        role: "viewer",
        createdAt: new Date("2026-02-01")
      });
      const other = await seedProject({ organizationId: organization.id });
      await seedProjectMember({ organizationId: organization.id, projectId: other.id, userId: member.id });

      const grants = await repository.findOfLiveProjects({ projectId: project.id });

      expect(grants).toEqual([
        { ...first, username: member.username, email: member.email },
        { ...second, username: colleague.username, email: colleague.email }
      ]);
    });

    it("leaves out the grants held by people whose organization role is neither member nor viewer", async () => {
      const { repository, organization, project, member } = await setup();
      const kept = await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id });
      for (const role of ["owner", "admin", "billing"] as const) {
        const holder = await seedUser({ userId: faker.string.uuid() });
        await seedOrganizationMember({ organizationId: organization.id, userId: holder.id, role });
        await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: holder.id });
      }

      const grants = await repository.findOfLiveProjects({ projectId: project.id });

      expect(grants.map(({ id }) => id)).toEqual([kept.id]);
    });

    it("finds a grant by id and leaves out the grants of deleted projects", async () => {
      const { repository, organization, member } = await setup();
      const deleted = await seedProject({ organizationId: organization.id, deletedAt: new Date() });
      const live = await seedProject({ organizationId: organization.id });
      const onDeleted = await seedProjectMember({ organizationId: organization.id, projectId: deleted.id, userId: member.id });
      const onLive = await seedProjectMember({ organizationId: organization.id, projectId: live.id, userId: member.id });

      expect(await repository.findOfLiveProjects({ id: onDeleted.id })).toEqual([]);
      expect(await repository.findOfLiveProjects({ id: onLive.id })).toEqual([expect.objectContaining({ id: onLive.id })]);
    });

    it("shows a member only the grants of the projects it reaches, inside the active organization", async () => {
      const { repository, organization, project, member, runIn } = await setup();
      const hidden = await seedProject({ organizationId: organization.id });
      const reached = await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id });
      await seedProjectMember({ organizationId: organization.id, projectId: hidden.id, userId: member.id });
      const { organization: foreign, project: foreignProject } = await seedOrganizationWithOwner();
      await seedOrganizationMember({ organizationId: foreign.id, userId: member.id, role: "member" });
      await seedProjectMember({ organizationId: foreign.id, projectId: foreignProject.id, userId: member.id });

      const grants = await runIn({ user: member, organizationId: organization.id, role: "member", projectScope: createProjectsScope([project.id]) }, ability =>
        repository.accessibleBy(ability, "read").findOfLiveProjects({})
      );

      expect(grants.map(({ id }) => id)).toEqual([reached.id]);
    });
  });

  describe("when the member leaves the organization", () => {
    it("drops every grant they held in it and keeps the ones they hold elsewhere", async () => {
      const { organization, project, member } = await setup();
      const other = await seedProject({ organizationId: organization.id });
      await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id });
      await seedProjectMember({ organizationId: organization.id, projectId: other.id, userId: member.id });
      const { organization: elsewhere, project: elsewhereProject } = await seedOrganizationWithOwner();
      await seedOrganizationMember({ organizationId: elsewhere.id, userId: member.id, role: "viewer" });
      const kept = await seedProjectMember({ organizationId: elsewhere.id, projectId: elsewhereProject.id, userId: member.id });
      const members = resolveTable("OrganizationMembers");

      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .delete(members)
        .where(and(eq(members.organizationId, organization.id), eq(members.userId, member.id)));

      expect(await grantRowsOf(member.id)).toEqual([kept]);
    });
  });

  async function grantRowsOf(userId: string) {
    const grants = resolveTable("ProjectMembers");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(grants).where(eq(grants.userId, userId));
  }

  async function setup() {
    const repository = container.resolve(ProjectMemberRepository);
    const txService = container.resolve(TxService);
    const { organization } = await seedOrganizationWithOwner();
    const project = await seedProject({ organizationId: organization.id });
    const member = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email() });
    await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" });
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);

    const runIn = <R>(
      { user: caller, ...context }: Partial<OrganizationContext> & { user: UserOutput },
      run: (ability: ReturnType<AbilityService["getAbilityFor"]>) => Promise<R>
    ) =>
      executionContextService.runWithContext(async () => {
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext(context));
        return await run(abilityService.getAbilityFor("REGULAR_USER", caller));
      });

    return { repository, txService, organization, project, member, runIn };
  }
});
