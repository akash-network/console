import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { personalOrganizationSlug } from "@src/organization/lib/personal-organization/personal-organization";
import { DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_SLUG } from "@src/organization/model-schemas/project/project.schema";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { PersonalOrganizationService } from "./personal-organization.service";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganization, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedPersonalOrganizationIdOf, seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(PersonalOrganizationService.name, () => {
  describe("ensureForUser", () => {
    it("creates one organization, one owner membership and one default project when called concurrently for the same user", async () => {
      const { service, user, organizationRepository, organizationMemberRepository, projectRepository } = await setup();

      const organizations = await Promise.all(Array.from({ length: 5 }, () => service.ensureForUser(user)));

      expect(new Set(organizations.map(organization => organization.id)).size).toBe(1);
      expect(organizations[0]).toMatchObject({ type: "personal", createdByUserId: user.id, name: user.username, slug: personalOrganizationSlug(user.id) });
      expect(await organizationRepository.count({ createdByUserId: user.id })).toBe(1);
      expect(await organizationMemberRepository.find({ userId: user.id })).toEqual([
        expect.objectContaining({ organizationId: organizations[0].id, role: "owner" })
      ]);
      expect(await projectRepository.find({ organizationId: organizations[0].id })).toEqual([
        expect.objectContaining({ name: "default-project", slug: "default-project", isDefault: true, createdByUserId: user.id })
      ]);
    });

    it("changes nothing when called again for a user who already has everything", async () => {
      const { service, user, organizationRepository, organizationMemberRepository, projectRepository } = await setup();

      const first = await service.ensureForUser(user);
      const second = await service.ensureForUser(user);

      expect(second).toEqual(first);
      expect(await organizationRepository.count({ createdByUserId: user.id })).toBe(1);
      expect(await organizationMemberRepository.count({ userId: user.id })).toBe(1);
      expect(await projectRepository.count({ organizationId: first.id })).toBe(1);
    });

    it("falls back to a numbered slug when the formulaic one is taken", async () => {
      const { service, user } = await setup();
      await seedOrganization({ slug: personalOrganizationSlug(user.id) });

      const organization = await service.ensureForUser(user);

      expect(organization.slug).toBe(personalOrganizationSlug(user.id, 1));
    });
  });

  describe("restoreDefaultProject", () => {
    it("gives a personal organization left without projects exactly one default project, however often it is called", async () => {
      const { service, user, projectRepository, db } = await setup();
      const organization = await service.ensureForUser(user);
      await db.delete(resolveTable("Projects")).where(eq(resolveTable("Projects").organizationId, organization.id));

      await Promise.all(Array.from({ length: 3 }, () => service.restoreDefaultProject(user, organization)));

      expect(await projectRepository.find({ organizationId: organization.id })).toEqual([
        expect.objectContaining({ isDefault: true, name: DEFAULT_PROJECT_NAME, slug: DEFAULT_PROJECT_SLUG, createdByUserId: user.id })
      ]);
    });

    it("leaves an organization that still has its default project as it is", async () => {
      const { service, user, projectRepository } = await setup();
      const organization = await service.ensureForUser(user);
      const before = await projectRepository.find({ organizationId: organization.id });

      await service.restoreDefaultProject(user, organization);

      expect(await projectRepository.find({ organizationId: organization.id })).toEqual(before);
    });
  });

  describe("adoptUserRows", () => {
    it("files the user's deployments and templates that are in no project into the default project, without touching anyone else's", async () => {
      const { service, user, projectRepository, seedRowsInNoProject, readProjectIds } = await setup();
      const stranger = await setup();
      const rows = await seedRowsInNoProject(user);
      const strangerRows = await stranger.seedRowsInNoProject(stranger.user);
      const organization = await service.ensureForUser(user);
      const project = await projectRepository.findDefaultByOrganizationId(organization.id);

      const counts = await service.adoptUserRows(user, organization);

      expect(counts).toEqual({ userWallets: 0, walletSettings: 0, paymentMethods: 0, stripeTransactions: 0, deploymentSettings: 1, apiKeys: 0, templates: 1 });
      expect(await readProjectIds(rows)).toEqual({ deploymentSettings: project?.id, templates: project?.id });
      expect(await readProjectIds(strangerRows)).toEqual({ deploymentSettings: null, templates: null });
    });

    it("adopts nothing the second time", async () => {
      const { service, user, seedRowsInNoProject } = await setup();
      await seedRowsInNoProject(user);
      const organization = await service.ensureForUser(user);
      await service.adoptUserRows(user, organization);

      const counts = await service.adoptUserRows(user, organization);

      expect(Object.values(counts)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it("leaves rows that already belong to an organization alone", async () => {
      const { service, user, db } = await setup();
      const { organization: other, project: otherProject } = await seedOrganizationWithOwner();
      const deployment = await seedDeploymentSetting({ userId: user.id, organizationId: other.id, projectId: otherProject.id });
      const organization = await service.ensureForUser(user);

      const counts = await service.adoptUserRows(user, organization);

      expect(counts.deploymentSettings).toBe(0);
      const [kept] = await db
        .select()
        .from(resolveTable("DeploymentSettings"))
        .where(eq(resolveTable("DeploymentSettings").id, deployment.id));
      expect(kept).toMatchObject({ organizationId: other.id, projectId: otherProject.id });
    });

    it("files a deployment already in the organization but in no project into its default project", async () => {
      const { service, user, db } = await setup();
      const organization = await service.ensureForUser(user);
      const deployment = await seedDeploymentSetting({ userId: user.id, organizationId: organization.id });

      const counts = await service.adoptUserRows(user, organization);

      expect(counts.deploymentSettings).toBe(1);
      const [filed] = await db
        .select()
        .from(resolveTable("DeploymentSettings"))
        .where(eq(resolveTable("DeploymentSettings").id, deployment.id));
      const defaultProject = await container.resolve(ProjectRepository).findDefaultByOrganizationId(organization.id);
      expect(filed).toMatchObject({ organizationId: organization.id, projectId: defaultProject?.id });
    });
  });

  async function setup() {
    const service = container.resolve(PersonalOrganizationService);
    const organizationRepository = container.resolve(OrganizationRepository);
    const organizationMemberRepository = container.resolve(OrganizationMemberRepository);
    const projectRepository = container.resolve(ProjectRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const user = await seedUser({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(10)}` });

    async function seedRowsInNoProject(owner: UserOutput) {
      const organizationId = await seedPersonalOrganizationIdOf(owner.id);
      const deploymentSetting = await seedDeploymentSetting({ userId: owner.id, organizationId });
      const [template] = await db
        .insert(resolveTable("Templates"))
        .values({ userId: owner.userId as string, organizationId, title: "template", cpu: 1, ram: 1, storage: 1, sdl: "version: '2.0'" })
        .returning();

      return { deploymentSettings: deploymentSetting.id, templates: template.id };
    }

    async function readProjectIds(rows: Awaited<ReturnType<typeof seedRowsInNoProject>>) {
      const [deploymentSettings] = await db
        .select()
        .from(resolveTable("DeploymentSettings"))
        .where(eq(resolveTable("DeploymentSettings").id, rows.deploymentSettings));
      const [templates] = await db
        .select()
        .from(resolveTable("Templates"))
        .where(eq(resolveTable("Templates").id, rows.templates));

      return { deploymentSettings: deploymentSettings.projectId, templates: templates.projectId };
    }

    return { service, user, db, organizationRepository, organizationMemberRepository, projectRepository, seedRowsInNoProject, readProjectIds };
  }
});
