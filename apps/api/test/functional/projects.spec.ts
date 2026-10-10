import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";

describe("Projects", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/projects", () => {
    it("lists the live projects of the active organization, default first, with who created them", async () => {
      const { request, team, defaultProject, owner } = await setupCaller({ role: "admin" });
      const project = await seedProject({ organizationId: team.id, createdByUserId: owner.id, description: "Storefront" });
      await seedProject({ organizationId: team.id, deletedAt: new Date() });
      await seedOrganizationWithOwner();

      const response = await request("/v1/projects");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [
          {
            id: defaultProject.id,
            name: defaultProject.name,
            slug: defaultProject.slug,
            description: null,
            isDefault: true,
            createdAt: defaultProject.createdAt.toISOString(),
            createdBy: { id: owner.id, username: owner.username }
          },
          {
            id: project.id,
            name: project.name,
            slug: project.slug,
            description: "Storefront",
            isDefault: false,
            createdAt: project.createdAt.toISOString(),
            createdBy: { id: owner.id, username: owner.username }
          }
        ]
      });
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

    it.each(["member", "viewer", "billing"] as const)("refuses to let a %s rename a project", async role => {
      const { request, team, user } = await setupCaller({ role });
      const project = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: "admin" });

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
      const address = await seedWallet(user.id);
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
      const address = await seedWallet(user.id);
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
      await seedWallet(user.id);
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

    it("answers not found for a project of another organization and leaves it in place", async () => {
      const { request } = await setupCaller({ role: "owner" });
      const { organization: other } = await seedOrganizationWithOwner();
      const foreign = await seedProject({ organizationId: other.id });

      const response = await request(`/v1/projects/${foreign.id}`, { method: "DELETE" });

      expect(response.status).toBe(404);
      expect(await projectRow(foreign.id)).toMatchObject({ deletedAt: null });
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

  async function projectRow(id: string) {
    const projects = resolveTable("Projects");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(projects).where(eq(projects.id, id));

    return row;
  }

  async function deploymentSettingRow(id: string) {
    const deploymentSettings = resolveTable("DeploymentSettings");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(deploymentSettings).where(eq(deploymentSettings.id, id));

    return row;
  }

  async function seedWallet(userId: string) {
    const address = createAkashAddress();
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId, address, deploymentAllowance: "0", feeAllowance: "0", isTrialing: false });

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
