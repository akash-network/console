import { faker } from "@faker-js/faker";
import { and, eq, isNull } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { ORGANIZATION_CONFIG } from "@src/organization/providers/config.provider";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import {
  seedOrganizationActivity,
  seedOrganizationMember,
  seedOrganizationWithOwner,
  seedProject,
  seedProjectMember
} from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";
import { createDeploymentGroup } from "@test/seeders/deployment-group.seeder";
import { createLease } from "@test/seeders/lease.seeder";
import { createProvider } from "@test/seeders/provider.seeder";

describe("Projects", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/projects", () => {
    it("lists the live projects of the active organization, most recently active first, with who created them", async () => {
      const { request, team, defaultProject, owner } = await setupCaller({ role: "admin" });
      const project = await seedProject({ organizationId: team.id, createdByUserId: owner.id, description: "Storefront" });
      await seedProject({ organizationId: team.id, deletedAt: new Date() });
      await seedOrganizationWithOwner();
      const latestActivityAt = new Date(project.createdAt.getTime() + 60_000);
      await seedOrganizationActivity({ organizationId: team.id, projectId: defaultProject.id, createdAt: latestActivityAt });

      const response = await request("/v1/projects");

      expect(response.status).toBe(200);
      const emptyAndManaged = { deployments: { activeCount: 0, preview: [] }, access: { canDeploy: true, canManage: true } };
      expect(await response.json()).toEqual({
        data: [
          {
            id: defaultProject.id,
            name: defaultProject.name,
            slug: defaultProject.slug,
            description: null,
            isDefault: true,
            createdAt: defaultProject.createdAt.toISOString(),
            createdBy: { id: owner.id, username: owner.username },
            lastActivityAt: latestActivityAt.toISOString(),
            ...emptyAndManaged
          },
          {
            id: project.id,
            name: project.name,
            slug: project.slug,
            description: "Storefront",
            isDefault: false,
            createdAt: project.createdAt.toISOString(),
            createdBy: { id: owner.id, username: owner.username },
            lastActivityAt: project.createdAt.toISOString(),
            ...emptyAndManaged
          }
        ]
      });
    });

    it("counts each project's deployments open on chain and previews the newest with the state of their leases", async () => {
      const { request, team, defaultProject, owner } = await setupCaller({ role: "owner" });
      const address = await seedTeamWallet(team.id);
      const inDefault = { userId: owner.id, organizationId: team.id, projectId: defaultProject.id };
      const running = await seedDeploymentOnChain({ ...inDefault, dseq: "4004", name: "web" }, address, { leases: [{ closedHeight: undefined }] });
      const degraded = await seedDeploymentOnChain({ ...inDefault, dseq: "4003" }, address, { leases: [{ closedHeight: 5_000_000 }] });
      const pending = await seedDeploymentOnChain({ ...inDefault, dseq: "4002" }, address, { leases: [] });
      await seedDeploymentOnChain({ ...inDefault, dseq: "4001" }, address, { leases: [] });
      await seedDeploymentOnChain({ ...inDefault, dseq: "4005" }, address, { leases: [], closedHeight: 5_000_000 });

      const response = await request("/v1/projects");

      expect(response.status).toBe(200);
      expect(projectsIn(await response.json()).find(({ id }) => id === defaultProject.id)?.deployments).toEqual({
        activeCount: 4,
        preview: [
          { dseq: running.dseq, name: "web", status: "running" },
          { dseq: degraded.dseq, name: null, status: "degraded" },
          { dseq: pending.dseq, name: null, status: "pending" }
        ]
      });
    });

    it("never tells a member what runs in the projects it was not granted, and lets it deploy only where its grant writes", async () => {
      const { request, team, defaultProject, owner, user } = await setupCaller({ role: "member" });
      const address = await seedTeamWallet(team.id);
      const [written, viewed] = [await seedProject({ organizationId: team.id }), await seedProject({ organizationId: team.id })];
      await seedProjectMember({ organizationId: team.id, projectId: written.id, userId: user.id, role: "member" });
      await seedProjectMember({ organizationId: team.id, projectId: viewed.id, userId: user.id, role: "viewer" });
      await seedDeploymentOnChain({ userId: owner.id, organizationId: team.id, projectId: written.id }, address, { leases: [] });
      await seedDeploymentOnChain({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id }, address, { leases: [] });

      const response = await request("/v1/projects");

      expect(response.status).toBe(200);
      const projects = projectsIn(await response.json());
      expect(projects.map(({ id }) => id).sort()).toEqual([written.id, viewed.id].sort());
      expect(projects.find(({ id }) => id === written.id)).toMatchObject({
        deployments: { activeCount: 1 },
        access: { canDeploy: true, canManage: false }
      });
      expect(projects.find(({ id }) => id === viewed.id)).toMatchObject({
        deployments: { activeCount: 0, preview: [] },
        access: { canDeploy: false, canManage: false }
      });
    });

    it("tells a billing member which projects exist but nothing of what runs or happens in them", async () => {
      const { request, team, defaultProject, owner } = await setupCaller({ role: "billing" });
      const address = await seedTeamWallet(team.id);
      await seedDeploymentOnChain({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id }, address, { leases: [] });
      await seedOrganizationActivity({
        organizationId: team.id,
        projectId: defaultProject.id,
        createdAt: new Date(defaultProject.createdAt.getTime() + 60_000)
      });

      const response = await request("/v1/projects");

      expect(response.status).toBe(200);
      expect(projectsIn(await response.json())).toEqual([
        expect.objectContaining({
          id: defaultProject.id,
          lastActivityAt: defaultProject.createdAt.toISOString(),
          deployments: null,
          access: { canDeploy: false, canManage: false }
        })
      ]);
    });

    it.each(["member", "viewer"] as const)("lists to a %s only the projects it was granted", async role => {
      const { request, team, user } = await setupCaller({ role });
      const granted = await seedProject({ organizationId: team.id });
      await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: granted.id, userId: user.id, role: "viewer" });

      const response = await request("/v1/projects");

      expect(response.status).toBe(200);
      expect(idsOf(await response.json())).toEqual([granted.id]);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { request } = await setupCaller({ role: "owner", organizationsOn: false });

      const response = await request("/v1/projects");

      expect(response.status).toBe(404);
    });
  });

  describe("POST /v1/projects", () => {
    it.each(["owner", "admin"] as const)("lets the %s create a project under the slug of its name and logs it to the activity", async role => {
      const { request, team, user } = await setupCaller({ role });

      const response = await request("/v1/projects", { method: "POST", body: { data: { name: "Checkout API", description: "Storefront" } } });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(data).toEqual({
        id: expect.any(String),
        name: "Checkout API",
        slug: "checkout-api",
        description: "Storefront",
        isDefault: false,
        createdAt: expect.any(String),
        createdBy: { id: user.id, username: user.username }
      });
      expect(await activitiesOfProject(data.id)).toEqual([
        expect.objectContaining({ organizationId: team.id, actorUserId: user.id, type: "project_created", payload: { projectName: "Checkout API" } })
      ]);
    });

    it.each(["member", "viewer", "billing"] as const)("refuses to let a %s create a project", async role => {
      const { request } = await setupCaller({ role });

      const response = await request("/v1/projects", { method: "POST", body: { data: { name: "web" } } });

      expect(response.status).toBe(403);
    });

    it("refuses a name another live project of the organization already has", async () => {
      const { request, team } = await setupCaller({ role: "owner" });
      await seedProject({ organizationId: team.id, name: "web", slug: "web" });

      const response = await request("/v1/projects", { method: "POST", body: { data: { name: "Web" } } });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "project_name_taken" });
    });

    it("takes the name of a deleted project or of a project in another organization", async () => {
      const { request, team } = await setupCaller({ role: "owner" });
      await seedProject({ organizationId: team.id, name: "web", slug: "web", deletedAt: new Date() });
      const { organization: other } = await seedOrganizationWithOwner();
      await seedProject({ organizationId: other.id, name: "web", slug: "web" });

      const response = await request("/v1/projects", { method: "POST", body: { data: { name: "web" } } });

      expect(response.status).toBe(201);
    });

    it("gives distinct names that share a slug numbered slugs", async () => {
      const { request, team } = await setupCaller({ role: "owner" });
      const longPrefix = "a".repeat(40);
      await seedProject({ organizationId: team.id, name: "Web App", slug: "web-app" });
      await seedProject({ organizationId: team.id, name: `${longPrefix}-one`, slug: longPrefix });

      const responses = await Promise.all(["web-app", `${longPrefix}-two`].map(name => request("/v1/projects", { method: "POST", body: { data: { name } } })));

      expect(responses.map(({ status }) => status)).toEqual([201, 201]);
      expect(await Promise.all(responses.map(async response => ((await response.json()) as { data: { slug: string } }).data.slug))).toEqual([
        "web-app-2",
        `${"a".repeat(38)}-2`
      ]);
    });

    it("lets the organization grow to its limit of live projects, then refuses the next one and tells the limit", async () => {
      const { request, team } = await setupCaller({ role: "owner" });
      const limit = container.resolve(ORGANIZATION_CONFIG).PROJECTS_PER_ORGANIZATION_LIMIT;
      await seedProject({ organizationId: team.id, deletedAt: new Date() });
      for (let index = 2; index < limit; index++) {
        await seedProject({ organizationId: team.id });
      }

      const last = await request("/v1/projects", { method: "POST", body: { data: { name: "last" } } });
      const pastLimit = await request("/v1/projects", { method: "POST", body: { data: { name: "past limit" } } });

      expect(last.status).toBe(201);
      expect(pastLimit.status).toBe(403);
      expect(await pastLimit.json()).toMatchObject({ code: "project_limit_reached", data: { limit } });
      expect(await liveProjectNamesOf(team.id)).not.toContain("past limit");
    });

    it("accepts a name without a latin letter or digit under a generated slug", async () => {
      const { request } = await setupCaller({ role: "owner" });

      const response = await request("/v1/projects", { method: "POST", body: { data: { name: "プロジェクト" } } });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { name: "プロジェクト", slug: expect.stringMatching(/^project-[0-9a-f]{8}$/) } });
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { request } = await setupCaller({ role: "owner", organizationsOn: false });

      const response = await request("/v1/projects", { method: "POST", body: { data: { name: "web" } } });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /v1/projects/{id}", () => {
    it("returns a project of the active organization", async () => {
      const { request, team } = await setupCaller({ role: "billing" });
      const project = await seedProject({ organizationId: team.id, createdByUserId: null });

      const response = await request(`/v1/projects/${project.id}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          description: null,
          isDefault: false,
          createdAt: project.createdAt.toISOString(),
          createdBy: null
        }
      });
    });

    it("answers not found for a project of another organization, a deleted one or one a member was not granted", async () => {
      const { request, team } = await setupCaller({ role: "member" });
      const { project: foreign } = await seedOrganizationWithOwner();
      const deleted = await seedProject({ organizationId: team.id, deletedAt: new Date() });
      const notGranted = await seedProject({ organizationId: team.id });

      const responses = await Promise.all([foreign, deleted, notGranted].map(({ id }) => request(`/v1/projects/${id}`)));

      expect(responses.map(({ status }) => status)).toEqual([404, 404, 404]);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { request, defaultProject } = await setupCaller({ role: "owner", organizationsOn: false });

      const response = await request(`/v1/projects/${defaultProject.id}`);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /v1/projects/{id}", () => {
    it.each(["owner", "admin"] as const)("lets the %s rename a project, keeping its slug, and change its description", async role => {
      const { request, team } = await setupCaller({ role });
      const project = await seedProject({ organizationId: team.id, description: "Old" });

      const response = await request(`/v1/projects/${project.id}`, { method: "PATCH", body: { data: { name: "Checkout API", description: null } } });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { id: project.id, name: "Checkout API", slug: project.slug, description: null } });
    });

    it.each([
      ["member", "member"],
      ["viewer", "admin"],
      ["billing", "admin"]
    ] as const)("refuses to let a %s holding the %s project role rename a project", async (role, projectRole) => {
      const { request, team, user } = await setupCaller({ role });
      const project = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: projectRole });

      const response = await request(`/v1/projects/${project.id}`, { method: "PATCH", body: { data: { name: "renamed" } } });

      expect(response.status).toBe(403);
    });

    it("refuses a name another live project of the organization already has", async () => {
      const { request, team } = await setupCaller({ role: "owner" });
      await seedProject({ organizationId: team.id, name: "web", slug: "web" });
      const project = await seedProject({ organizationId: team.id });

      const response = await request(`/v1/projects/${project.id}`, { method: "PATCH", body: { data: { name: "WEB" } } });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "project_name_taken" });
    });

    it("answers not found for a project of another organization and leaves it unchanged", async () => {
      const { request } = await setupCaller({ role: "owner" });
      const { project: foreign } = await seedOrganizationWithOwner();

      const response = await request(`/v1/projects/${foreign.id}`, { method: "PATCH", body: { data: { name: "taken-over" } } });

      expect(response.status).toBe(404);
      expect(await projectRow(foreign.id)).toMatchObject({ name: foreign.name });
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { request, defaultProject } = await setupCaller({ role: "owner", organizationsOn: false });

      const response = await request(`/v1/projects/${defaultProject.id}`, { method: "PATCH", body: { data: { name: "renamed" } } });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /v1/projects/{id}", () => {
    it.each(["owner", "admin"] as const)("lets the %s delete a project holding only closed deployments", async role => {
      const { request, team, user } = await setupCaller({ role });
      const project = await seedProject({ organizationId: team.id });
      await seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: project.id, closed: true });

      const response = await request(`/v1/projects/${project.id}`, { method: "DELETE" });

      expect(response.status).toBe(204);
      expect(await projectRow(project.id)).toMatchObject({ deletedAt: expect.any(Date) });
    });

    it("refuses to delete the default project", async () => {
      const { request, defaultProject } = await setupCaller({ role: "owner" });

      const response = await request(`/v1/projects/${defaultProject.id}`, { method: "DELETE" });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "project_is_default" });
    });

    it("refuses to delete a project whose deployment is still open on chain and closes the ones the chain reports closed", async () => {
      const { request, team, user } = await setupCaller({ role: "owner" });
      const project = await seedProject({ organizationId: team.id });
      const address = await seedTeamWallet(team.id);
      const openOnChain = await seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: project.id });
      const closedOnChain = await seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: project.id });
      await createDeployment({ owner: address, dseq: openOnChain.dseq });
      await createDeployment({ owner: address, dseq: closedOnChain.dseq, closedHeight: 5_000_000 });

      const response = await request(`/v1/projects/${project.id}`, { method: "DELETE" });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "project_not_empty" });
      expect(await projectRow(project.id)).toMatchObject({ deletedAt: null });
      expect(await deploymentSettingRow(openOnChain.id)).toMatchObject({ closed: false });
      expect(await deploymentSettingRow(closedOnChain.id)).toMatchObject({ closed: true });
    });

    it("deletes a project whose deployments the console still holds open once the chain reports them closed", async () => {
      const { request, team, user } = await setupCaller({ role: "owner" });
      const project = await seedProject({ organizationId: team.id });
      const address = await seedTeamWallet(team.id);
      const setting = await seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: project.id });
      await createDeployment({ owner: address, dseq: setting.dseq, closedHeight: 5_000_000 });

      const response = await request(`/v1/projects/${project.id}`, { method: "DELETE" });

      expect(response.status).toBe(204);
      expect(await projectRow(project.id)).toMatchObject({ deletedAt: expect.any(Date) });
      expect(await deploymentSettingRow(setting.id)).toMatchObject({ closed: true });
    });

    it("refuses to delete a project holding an open deployment the chain has no record of", async () => {
      const { request, team, user } = await setupCaller({ role: "owner" });
      const project = await seedProject({ organizationId: team.id });
      await seedTeamWallet(team.id);
      await seedDeploymentSetting({ userId: user.id, organizationId: team.id, projectId: project.id });

      const response = await request(`/v1/projects/${project.id}`, { method: "DELETE" });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "project_not_empty" });
    });

    it.each(["member", "viewer", "billing"] as const)("refuses to let a %s delete a project", async role => {
      const { request, team, user } = await setupCaller({ role });
      const project = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: "admin" });

      const response = await request(`/v1/projects/${project.id}`, { method: "DELETE" });

      expect(response.status).toBe(403);
      expect(await projectRow(project.id)).toMatchObject({ deletedAt: null });
    });

    it("answers not found for a project of another organization and leaves it and its deployments in place", async () => {
      const { request } = await setupCaller({ role: "owner" });
      const { user: otherOwner, organization: other } = await seedOrganizationWithOwner();
      const foreign = await seedProject({ organizationId: other.id });
      const foreignDeployment = await seedDeploymentClosedOnChain({ userId: otherOwner.id, organizationId: other.id, projectId: foreign.id });

      const response = await request(`/v1/projects/${foreign.id}`, { method: "DELETE" });

      expect(response.status).toBe(404);
      expect(await projectRow(foreign.id)).toMatchObject({ deletedAt: null });
      expect(await deploymentSettingRow(foreignDeployment.id)).toMatchObject({ closed: false });
    });

    it("closes only the active organization's deployments of the project it deletes", async () => {
      const { request, team, user } = await setupCaller({ role: "owner" });
      const project = await seedProject({ organizationId: team.id });
      const own = await seedDeploymentClosedOnChain({ userId: user.id, organizationId: team.id, projectId: project.id });
      const { user: otherOwner, organization: other, project: otherProject } = await seedOrganizationWithOwner();
      const foreign = await seedDeploymentClosedOnChain({ userId: otherOwner.id, organizationId: other.id, projectId: otherProject.id, dseq: own.dseq });

      const response = await request(`/v1/projects/${project.id}`, { method: "DELETE" });

      expect(response.status).toBe(204);
      expect(await deploymentSettingRow(own.id)).toMatchObject({ closed: true });
      expect(await deploymentSettingRow(foreign.id)).toMatchObject({ closed: false });
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { request, team } = await setupCaller({ role: "owner", organizationsOn: false });
      const project = await seedProject({ organizationId: team.id });

      const response = await request(`/v1/projects/${project.id}`, { method: "DELETE" });

      expect(response.status).toBe(404);
      expect(await projectRow(project.id)).toMatchObject({ deletedAt: null });
    });
  });

  function idsOf(body: unknown) {
    return (body as { data: { id: string }[] }).data.map(({ id }) => id);
  }

  function projectsIn(body: unknown) {
    return (body as { data: Array<{ id: string; deployments: unknown; access: unknown }> }).data;
  }

  async function seedDeploymentOnChain(
    setting: { userId: string; organizationId: string; projectId: string; dseq?: string; name?: string },
    address: string,
    chain: { leases: Array<{ closedHeight?: number }>; closedHeight?: number }
  ) {
    const filed = await seedDeploymentSetting(setting);
    const deployment = await createDeployment({ owner: address, dseq: filed.dseq, closedHeight: chain.closedHeight });
    for (const [index, lease] of chain.leases.entries()) {
      const [group, provider] = await Promise.all([
        createDeploymentGroup({ deploymentId: deployment.id, owner: address, dseq: filed.dseq, gseq: index + 1 }),
        createProvider()
      ]);
      await createLease({
        deploymentId: deployment.id,
        deploymentGroupId: group.id,
        owner: address,
        dseq: filed.dseq,
        gseq: index + 1,
        providerAddress: provider.owner,
        ...lease
      });
    }

    return filed;
  }

  async function projectRow(id: string) {
    const projects = resolveTable("Projects");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(projects).where(eq(projects.id, id));

    return row;
  }

  async function liveProjectNamesOf(organizationId: string) {
    const projects = resolveTable("Projects");
    const rows = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .select({ name: projects.name })
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), isNull(projects.deletedAt)));

    return rows.map(({ name }) => name);
  }

  async function deploymentSettingRow(id: string) {
    const deploymentSettings = resolveTable("DeploymentSettings");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(deploymentSettings).where(eq(deploymentSettings.id, id));

    return row;
  }

  async function seedDeploymentClosedOnChain(input: { userId: string; organizationId: string; projectId: string; dseq?: string }) {
    const address = await seedTeamWallet(input.organizationId);
    const setting = await seedDeploymentSetting(input);
    await createDeployment({ owner: address, dseq: setting.dseq, closedHeight: 5_000_000 });

    return setting;
  }

  async function seedTeamWallet(organizationId: string) {
    const address = createAkashAddress();
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId, address, deploymentAllowance: "0", feeAllowance: "0", isTrialing: false });

    return address;
  }

  async function activitiesOfProject(projectId: string) {
    const activities = resolveTable("OrganizationActivities");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(activities).where(eq(activities.projectId, projectId));
  }

  function signIn(externalUserId: string) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );

    return `Bearer ${token}`;
  }

  function enableOrganizationsFor(userIds: string[]) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return userIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setupCaller(input: { role: OrganizationRole; organizationsOn?: boolean }) {
    const { user: owner, organization: team, project: defaultProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const caller = input.role === "owner" ? owner : await seedUser(createSignedUpUserInput());
    if (input.role !== "owner") {
      await seedOrganizationMember({ organizationId: team.id, userId: caller.id, role: input.role });
    }
    const authorization = signIn(caller.userId!);
    enableOrganizationsFor(input.organizationsOn === false ? [] : [caller.id]);

    const request = (path: string, init: { method?: string; body?: unknown } = {}) =>
      app.request(path, {
        method: init.method ?? "GET",
        headers: { authorization, "x-organization-id": team.id, "content-type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });

    return { request, team, defaultProject, owner, user: caller };
  }
});
