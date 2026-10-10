import { ForbiddenError } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { readdirSync } from "node:fs";
import path from "node:path";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { API_PG_TABLE_NAMES, resolveTable } from "@src/core/providers/postgres.provider";
import { BaseRepository } from "@src/core/repositories/base.repository";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE, OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { OrganizationInvitationRepository } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";

const SOURCE_ROOT = path.resolve(__dirname, "../..");

type AnyRepository = BaseRepository<any, any, any>;

describe(OrgScopedRepository.name, () => {
  describe("in organization mode", () => {
    it("returns only the active organization's rows from a query that names no organization", async () => {
      const { active, other, repository, runIn } = await setup();
      const activeSetting = await seedDeploymentSetting(active);
      await seedDeploymentSetting(other);

      const settings = await runIn(active, () => repository.find());

      expect(settings.map(({ id }) => id)).toEqual([activeSetting.id]);
    });

    it("keeps another organization's invitations out of a lookup by token", async () => {
      const { active, other, runIn } = await setup();
      const invitationRepository = container.resolve(OrganizationInvitationRepository);
      const tokenHash = faker.string.hexadecimal({ length: 64, prefix: "" });
      await invitationRepository.create({
        organizationId: other.organization.id,
        email: faker.internet.email().toLowerCase(),
        role: "member",
        tokenHash,
        expiresAt: faker.date.soon()
      });

      const [fromActive, fromOther] = await Promise.all([
        runIn(active, () => invitationRepository.findOneBy({ tokenHash })),
        runIn(other, () => invitationRepository.findOneBy({ tokenHash }))
      ]);

      expect(fromActive).toBeUndefined();
      expect(fromOther).toMatchObject({ organizationId: other.organization.id, tokenHash });
    });

    it("lists every organization's rows through an unscoped repository", async () => {
      const { active, other, repository, runIn } = await setup();
      const activeSetting = await seedDeploymentSetting(active);
      const otherSetting = await seedDeploymentSetting(other);

      const settings = await runIn(active, async () => {
        const unscoped = repository.unscoped("platform-statistics");
        return [...(await unscoped.find({ userId: active.owner.id })), ...(await unscoped.find({ userId: other.owner.id }))];
      });

      expect(settings.map(({ id }) => id)).toEqual([activeSetting.id, otherSetting.id]);
    });

    it("rejects an insert naming another organization", async () => {
      const { active, other, repository, runIn } = await setup();

      await expect(
        runIn(active, () => repository.create({ userId: active.owner.id, dseq: faker.string.numeric(8), organizationId: other.organization.id }))
      ).rejects.toMatchObject({ status: 403, errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
      expect(await repository.find({ organizationId: other.organization.id })).toEqual([]);
    });

    it("rejects moving a row to another organization and leaves it where it was", async () => {
      const { active, other, repository, runIn } = await setup();
      const setting = await seedDeploymentSetting(active);

      await expect(runIn(active, () => repository.updateById(setting.id, { organizationId: other.organization.id }))).rejects.toMatchObject({ status: 403 });
      expect(await repository.findById(setting.id)).toMatchObject({ organizationId: active.organization.id });
    });

    it("keeps a bulk update inside the active organization", async () => {
      const { active, other, repository, runIn } = await setup();
      const activeSetting = await seedDeploymentSetting(active);
      const otherSetting = await seedDeploymentSetting(other);

      await runIn(active, () => repository.updateManyById([activeSetting.id, otherSetting.id], { name: "renamed" }));

      expect(await repository.findById(activeSetting.id)).toMatchObject({ name: "renamed" });
      expect(await repository.findById(otherSetting.id)).toMatchObject({ name: null });
    });

    it("rejects an update that moves a row to a project outside the member's scope and keeps it unchanged", async () => {
      const { active, repository, runIn } = await setup();
      const member = await seedUser();
      await seedOrganizationMember({ organizationId: active.organization.id, userId: member.id, role: "member" });
      const outOfScopeProject = await seedProject({ organizationId: active.organization.id });
      const setting = await seedDeploymentSetting(active, { userId: member.id });
      const context = { role: "member" as const, projectScope: createProjectsScope([active.project.id]) };

      await expect(
        runIn(active, ability => repository.accessibleBy(ability, "update").updateById(setting.id, { projectId: outOfScopeProject.id }), {
          user: member,
          ...context
        })
      ).rejects.toThrow(ForbiddenError);
      expect(await repository.findById(setting.id)).toMatchObject({ projectId: active.project.id });
    });

    it("rejects an admin promoting a member to owner and keeps the member's role", async () => {
      const { active, runIn } = await setup();
      const admin = await seedUser();
      await seedOrganizationMember({ organizationId: active.organization.id, userId: admin.id, role: "admin" });
      const member = await seedUser();
      const membership = await seedOrganizationMember({ organizationId: active.organization.id, userId: member.id, role: "member" });
      const memberRepository = container.resolve(OrganizationMemberRepository);

      await expect(
        runIn(active, ability => memberRepository.accessibleBy(ability, "update").updateById(membership.id, { role: "owner" }), { user: admin, role: "admin" })
      ).rejects.toThrow(ForbiddenError);
      expect(await memberRepository.findById(membership.id)).toMatchObject({ role: "member" });
    });
  });

  describe("coverage", () => {
    it("scopes every table that carries an organization", async () => {
      const organizationTables = API_PG_TABLE_NAMES.map((name): unknown => resolveTable(name))
        .filter((table): table is PgTable => is(table, PgTable))
        .filter(table => Object.values(getTableColumns(table)).some(column => column.name === "organization_id"))
        .map(table => getTableName(table));

      const repositories = await loadRepositories();
      const scopedTables = repositories.filter(repository => repository instanceof OrgScopedRepository).map(repository => getTableName(repository["table"]));
      const unscopedOrganizationTables = repositories
        .filter(repository => !(repository instanceof OrgScopedRepository))
        .map(repository => getTableName(repository["table"]))
        .filter(table => organizationTables.includes(table));

      expect(organizationTables).not.toHaveLength(0);
      expect(organizationTables.filter(table => !scopedTables.includes(table))).toEqual([]);
      expect(unscopedOrganizationTables).toEqual([]);
    });
  });

  async function loadRepositories(): Promise<AnyRepository[]> {
    const files = readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" }).filter(file => file.endsWith(".repository.ts"));
    const modules: Array<Record<string, unknown>> = await Promise.all(files.map(file => import(path.join(SOURCE_ROOT, file))));

    return modules
      .flatMap(module => Object.values(module))
      .filter((value): value is new (...args: any[]) => AnyRepository => typeof value === "function" && value.prototype instanceof BaseRepository)
      .filter(repositoryClass => !Object.is(repositoryClass, OrgScopedRepository))
      .map(repositoryClass => container.resolve(repositoryClass));
  }

  async function seedDeploymentSetting(
    tenant: { owner: UserOutput; organization: { id: string }; project: { id: string } },
    overrides: { userId?: string } = {}
  ) {
    return await container.resolve(DeploymentSettingRepository).create({
      userId: overrides.userId ?? tenant.owner.id,
      dseq: faker.string.numeric(10),
      organizationId: tenant.organization.id,
      projectId: tenant.project.id
    });
  }

  async function setup() {
    const [active, other] = await Promise.all([seedTenant(), seedTenant()]);
    const repository = container.resolve(DeploymentSettingRepository);
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);

    const runIn = <R>(
      tenant: Awaited<ReturnType<typeof seedTenant>>,
      run: (ability: ReturnType<AbilityService["getAbilityFor"]>) => Promise<R>,
      overrides: Partial<OrganizationContext> & { user?: UserOutput } = {}
    ) =>
      executionContextService.runWithContext(async () => {
        const { user = tenant.owner, ...contextOverrides } = overrides;
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId: tenant.organization.id, ...contextOverrides }));
        return await run(abilityService.getAbilityFor("REGULAR_USER", user));
      });

    return { active, other, repository, runIn };
  }

  async function seedTenant() {
    const { user, organization, project } = await seedOrganizationWithOwner();
    return { owner: user, organization, project };
  }
});
