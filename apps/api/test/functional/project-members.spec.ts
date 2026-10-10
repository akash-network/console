import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
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
import type { UserOutput } from "@src/user/repositories";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("Project members", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/projects/{id}/members", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lists to the %s the grants of a project with each grantee's username and email", async role => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember(role);
      const grantee = await addMember("viewer");
      const grant = await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: grantee.id, role: "viewer" });

      const response = await actAs(caller)(`/v1/projects/${project.id}/members`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [
          {
            id: grant.id,
            projectId: project.id,
            userId: grantee.id,
            username: grantee.username,
            email: grantee.email,
            role: "viewer",
            createdAt: grant.createdAt.toISOString()
          }
        ]
      });
    });

    it.each<OrganizationRole>(["member", "viewer"])("lets a %s list who else was granted a project it reaches", async role => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember(role);
      const colleague = await addMember("member");
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: caller.id });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: colleague.id });

      const response = await actAs(caller)(`/v1/projects/${project.id}/members`);

      expect(response.status).toBe(200);
      expect(userIdsOf(await response.json())).toEqual([caller.id, colleague.id]);
    });

    it("answers 404 to a member for a project it was not granted", async () => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember("member");
      const colleague = await addMember("member");
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: colleague.id });

      const response = await actAs(caller)(`/v1/projects/${project.id}/members`);

      expect(response.status).toBe(404);
    });

    it("answers 404 for a project of another organization or a deleted one", async () => {
      const { team, owner, actAs } = await setup();
      const { project: foreign } = await seedOrganizationWithOwner();
      const deleted = await seedProject({ organizationId: team.id, deletedAt: new Date() });

      const responses = await Promise.all([foreign, deleted].map(({ id }) => actAs(owner)(`/v1/projects/${id}/members`)));

      expect(responses.map(({ status }) => status)).toEqual([404, 404]);
    });

    it("refuses a billing member", async () => {
      const { project, actAs, addMember } = await setup();
      const caller = await addMember("billing");

      const response = await actAs(caller)(`/v1/projects/${project.id}/members`);

      expect(response.status).toBe(403);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { project, owner, actAs } = await setup({ organizationsOn: false });

      const response = await actAs(owner)(`/v1/projects/${project.id}/members`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /v1/project-members", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets the %s grant a member access to a project and records it there", async role => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember(role);
      const grantee = await addMember("member");

      const response = await actAs(caller)("/v1/project-members", { method: "POST", body: { data: { projectId: project.id, userId: grantee.id, role: "member" } } });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        data: {
          id: expect.any(String),
          projectId: project.id,
          userId: grantee.id,
          username: grantee.username,
          email: grantee.email,
          role: "member",
          createdAt: expect.any(String)
        }
      });
      expect(await grantsOf(grantee.id)).toEqual([expect.objectContaining({ organizationId: team.id, projectId: project.id, role: "member" })]);
      expect(await activitiesOfProject(project.id)).toEqual([
        expect.objectContaining({
          organizationId: team.id,
          actorUserId: caller.id,
          type: "member_granted",
          payload: { userId: grantee.id, username: grantee.username, role: "member" }
        })
      ]);
    });

    it("grants a viewer access to the default project", async () => {
      const { defaultProject, owner, actAs, addMember } = await setup();
      const grantee = await addMember("viewer");

      const response = await actAs(owner)("/v1/project-members", {
        method: "POST",
        body: { data: { projectId: defaultProject.id, userId: grantee.id, role: "viewer" } }
      });

      expect(response.status).toBe(201);
      expect(await grantsOf(grantee.id)).toEqual([expect.objectContaining({ projectId: defaultProject.id, role: "viewer" })]);
    });

    it.each<OrganizationRole>(["member", "viewer", "billing"])("refuses to let a %s grant access", async role => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember(role);
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: caller.id, role: "admin" });
      const grantee = await addMember("member");

      const response = await actAs(caller)("/v1/project-members", { method: "POST", body: { data: { projectId: project.id, userId: grantee.id, role: "member" } } });

      expect(response.status).toBe(403);
      expect(await grantsOf(grantee.id)).toEqual([]);
    });

    it.each<OrganizationRole>(["owner", "admin"])("refuses to grant a %s, who already reaches every project", async role => {
      const { project, owner, actAs, addMember } = await setup();
      const grantee = await addMember(role);

      const response = await actAs(owner)("/v1/project-members", { method: "POST", body: { data: { projectId: project.id, userId: grantee.id, role: "member" } } });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "implicit_project_access" });
      expect(await grantsOf(grantee.id)).toEqual([]);
    });

    it("refuses to grant a billing member", async () => {
      const { project, owner, actAs, addMember } = await setup();
      const grantee = await addMember("billing");

      const response = await actAs(owner)("/v1/project-members", { method: "POST", body: { data: { projectId: project.id, userId: grantee.id, role: "viewer" } } });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "billing_role_not_grantable" });
    });

    it("refuses a grant the member already holds, even when two arrive at once", async () => {
      const { project, owner, actAs, addMember } = await setup();
      const grantee = await addMember("member");
      const body = { data: { projectId: project.id, userId: grantee.id, role: "member" } };

      const responses = await Promise.all([1, 2].map(() => actAs(owner)("/v1/project-members", { method: "POST", body })));

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
      expect(await responses.find(({ status }) => status === 409)?.json()).toMatchObject({ code: "already_granted" });
      expect(await grantsOf(grantee.id)).toHaveLength(1);
    });

    it("answers 404 for a user outside the organization, a project of another organization or a deleted project", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const { user: outsider, organization: foreign, project: foreignProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const grantee = await addMember("member");
      await seedOrganizationMember({ organizationId: foreign.id, userId: grantee.id, role: "member" });
      const deleted = await seedProject({ organizationId: team.id, deletedAt: new Date() });

      const responses = await Promise.all(
        [
          { projectId: project.id, userId: outsider.id },
          { projectId: foreignProject.id, userId: grantee.id },
          { projectId: deleted.id, userId: grantee.id }
        ].map(target => actAs(owner)("/v1/project-members", { method: "POST", body: { data: { ...target, role: "member" } } }))
      );

      expect(responses.map(({ status }) => status)).toEqual([404, 404, 404]);
      expect([...(await grantsOf(outsider.id)), ...(await grantsOf(grantee.id))]).toEqual([]);
    });

    it("answers 400 for a role projects do not have", async () => {
      const { project, owner, actAs, addMember } = await setup();
      const grantee = await addMember("member");

      const response = await actAs(owner)("/v1/project-members", { method: "POST", body: { data: { projectId: project.id, userId: grantee.id, role: "owner" } } });

      expect(response.status).toBe(400);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { project, owner, actAs, addMember } = await setup({ organizationsOn: false });
      const grantee = await addMember("member");

      const response = await actAs(owner)("/v1/project-members", { method: "POST", body: { data: { projectId: project.id, userId: grantee.id, role: "member" } } });

      expect(response.status).toBe(404);
      expect(await grantsOf(grantee.id)).toEqual([]);
    });
  });

  describe("PATCH /v1/project-members/{id}", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets the %s change the role a grant gives", async role => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember(role);
      const grantee = await addMember("member");
      const grant = await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: grantee.id, role: "viewer" });

      const response = await actAs(caller)(`/v1/project-members/${grant.id}`, { method: "PATCH", body: { data: { role: "admin" } } });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { id: grant.id, userId: grantee.id, role: "admin" } });
      expect(await grantsOf(grantee.id)).toEqual([expect.objectContaining({ id: grant.id, role: "admin" })]);
    });

    it("refuses a member granted the project and leaves the grant as it was", async () => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember("member");
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: caller.id, role: "admin" });
      const grant = await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: (await addMember("member")).id, role: "viewer" });

      const response = await actAs(caller)(`/v1/project-members/${grant.id}`, { method: "PATCH", body: { data: { role: "admin" } } });

      expect(response.status).toBe(403);
      expect(await grantRow(grant.id)).toMatchObject({ role: "viewer" });
    });

    it("answers 404 for a grant of another organization", async () => {
      const { owner, actAs } = await setup();
      const foreignGrant = await seedForeignGrant();

      const response = await actAs(owner)(`/v1/project-members/${foreignGrant.id}`, { method: "PATCH", body: { data: { role: "admin" } } });

      expect(response.status).toBe(404);
      expect(await grantRow(foreignGrant.id)).toMatchObject({ role: "member" });
    });
  });

  describe("DELETE /v1/project-members/{id}", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets the %s revoke a grant and records it on the project", async role => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember(role);
      const grantee = await addMember("member");
      const grant = await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: grantee.id });

      const response = await actAs(caller)(`/v1/project-members/${grant.id}`, { method: "DELETE" });

      expect(response.status).toBe(204);
      expect(await grantsOf(grantee.id)).toEqual([]);
      expect(await activitiesOfProject(project.id)).toEqual([
        expect.objectContaining({ actorUserId: caller.id, type: "member_revoked", payload: { userId: grantee.id, username: grantee.username } })
      ]);
    });

    it("refuses a viewer granted the project", async () => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember("viewer");
      const grant = await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: caller.id });

      const response = await actAs(caller)(`/v1/project-members/${grant.id}`, { method: "DELETE" });

      expect(response.status).toBe(403);
      expect(await grantRow(grant.id)).toBeDefined();
    });

    it("answers 404 for a grant of another organization", async () => {
      const { owner, actAs } = await setup();
      const foreignGrant = await seedForeignGrant();

      const response = await actAs(owner)(`/v1/project-members/${foreignGrant.id}`, { method: "DELETE" });

      expect(response.status).toBe(404);
      expect(await grantRow(foreignGrant.id)).toBeDefined();
    });
  });

  describe("when access is revoked", () => {
    it("refuses the member's very next request on the project", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const member = await addMember("member");
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: project.id, autoTopUpEnabled: false });
      const granted = await actAs(owner)("/v1/project-members", { method: "POST", body: { data: { projectId: project.id, userId: member.id, role: "member" } } });
      const { data: grant } = (await granted.json()) as { data: { id: string } };

      const beforeRevoke = await Promise.all([
        actAs(member)(`/v1/projects/${project.id}`),
        actAs(member)(`/v2/deployment-settings/${deployment.dseq}?userId=${owner.id}`)
      ]);
      const revoked = await actAs(owner)(`/v1/project-members/${grant.id}`, { method: "DELETE" });
      const afterRevoke = await Promise.all([
        actAs(member)(`/v1/projects/${project.id}`),
        actAs(member)(`/v2/deployment-settings/${deployment.dseq}?userId=${owner.id}`)
      ]);

      expect(beforeRevoke.map(({ status }) => status)).toEqual([200, 200]);
      expect(revoked.status).toBe(204);
      expect(afterRevoke.map(({ status }) => status)).toEqual([404, 404]);
    });
  });

  describe("when the member is removed from the organization", () => {
    it("drops their grants and refuses their next request in it", async () => {
      const { team, project, defaultProject, owner, actAs, addMember } = await setup();
      const member = await addMember("member");
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: member.id });
      await seedProjectMember({ organizationId: team.id, projectId: defaultProject.id, userId: member.id });
      const members = resolveTable("OrganizationMembers");

      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .delete(members)
        .where(and(eq(members.organizationId, team.id), eq(members.userId, member.id)));
      const ownerView = await actAs(owner)(`/v1/projects/${project.id}/members`);
      const memberView = await actAs(member)("/v1/projects");

      expect(await grantsOf(member.id)).toEqual([]);
      expect(await ownerView.json()).toEqual({ data: [] });
      expect(memberView.status).toBe(403);
      expect(await memberView.json()).toMatchObject({ code: "organization_forbidden" });
    });
  });

  describe("a member's reach", () => {
    it("lists and reads only the projects and deployment settings of the projects it was granted", async () => {
      const { team, project, defaultProject, owner, actAs, addMember } = await setup();
      const member = await addMember("member");
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: member.id });
      const granted = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: project.id, autoTopUpEnabled: false });
      const notGranted = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id, autoTopUpEnabled: false });

      const projects = await actAs(member)("/v1/projects");
      const settings = await Promise.all(
        [granted, notGranted].map(({ dseq }) => actAs(member)(`/v2/deployment-settings/${dseq}?userId=${owner.id}`))
      );
      const defaultProjectResponse = await actAs(member)(`/v1/projects/${defaultProject.id}`);

      expect((await projects.json()) as { data: { id: string }[] }).toMatchObject({ data: [{ id: project.id }] });
      expect(settings.map(({ status }) => status)).toEqual([200, 404]);
      expect(defaultProjectResponse.status).toBe(404);
    });

    it("keeps colleagues' private templates private, granted project or not", async () => {
      const { team, project, defaultProject, owner, actAs, addMember } = await setup();
      const member = await addMember("member");
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: member.id });
      const inGranted = await seedTemplate({ userId: owner.userId!, organizationId: team.id, projectId: project.id });
      const inNotGranted = await seedTemplate({ userId: owner.userId!, organizationId: team.id, projectId: defaultProject.id });
      const own = await seedTemplate({ userId: member.userId!, organizationId: team.id, projectId: project.id });

      const reads = await Promise.all([inGranted, inNotGranted, own].map(({ id }) => actAs(member)(`/v1/user/template/${id}`)));
      const listed = await actAs(member)(`/v1/user/templates/${member.username}`);

      expect(reads.map(({ status }) => status)).toEqual([404, 404, 200]);
      expect(((await listed.json()) as { id: string }[]).map(({ id }) => id)).toEqual([own.id]);
    });

    it("gives a member granted nothing an empty project list and nothing else", async () => {
      const { team, defaultProject, owner, actAs, addMember } = await setup();
      const member = await addMember("member");
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id, autoTopUpEnabled: false });

      const responses = await Promise.all([
        actAs(member)("/v1/projects"),
        actAs(member)(`/v1/projects/${defaultProject.id}`),
        actAs(member)(`/v1/projects/${defaultProject.id}/members`),
        actAs(member)(`/v2/deployment-settings/${deployment.dseq}?userId=${owner.id}`),
        actAs(member)("/v1/organization-activities")
      ]);

      expect(responses.map(({ status }) => status)).toEqual([200, 404, 404, 404, 200]);
      expect(await responses[0].json()).toEqual({ data: [] });
    });
  });

  function userIdsOf(body: unknown) {
    return (body as { data: { userId: string }[] }).data.map(({ userId }) => userId);
  }

  async function grantsOf(userId: string) {
    const grants = resolveTable("ProjectMembers");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(grants).where(eq(grants.userId, userId));
  }

  async function grantRow(id: string) {
    const grants = resolveTable("ProjectMembers");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(grants).where(eq(grants.id, id));

    return row;
  }

  async function activitiesOfProject(projectId: string) {
    const activities = resolveTable("OrganizationActivities");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(activities).where(eq(activities.projectId, projectId));
  }

  async function seedForeignGrant() {
    const { organization: foreign, project: foreignProject } = await seedOrganizationWithOwner();
    const grantee = await seedUser(createSignedUpUserInput());
    await seedOrganizationMember({ organizationId: foreign.id, userId: grantee.id, role: "member" });

    return await seedProjectMember({ organizationId: foreign.id, projectId: foreignProject.id, userId: grantee.id, role: "member" });
  }

  async function seedTemplate(input: { userId: string; organizationId: string; projectId: string }) {
    const [template] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({ ...input, title: faker.lorem.words(3), sdl: "version: '2.0'", cpu: 1000, ram: 1024, storage: 1024, isPublic: false })
      .returning();

    return template;
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() };
  }

  async function setup(input: { organizationsOn?: boolean } = {}) {
    const { user: owner, organization: team, project: defaultProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const project = await seedProject({ organizationId: team.id });
    const tokens = new Map<string, string>();
    const flaggedUserIds: string[] = [];

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null);
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return flaggedUserIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });

    const signIn = (user: UserOutput) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);
      if (input.organizationsOn !== false) flaggedUserIds.push(user.id);

      return `Bearer ${token}`;
    };

    const actAs = (user: UserOutput) => {
      const authorization = signIn(user);

      return (path: string, init: { method?: string; body?: unknown } = {}) =>
        app.request(path, {
          method: init.method ?? "GET",
          headers: { authorization, "x-organization-id": team.id, "content-type": "application/json" },
          body: init.body === undefined ? undefined : JSON.stringify(init.body)
        });
    };

    const addMember = async (role: OrganizationRole) => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });

      return user;
    };

    return { team, project, defaultProject, owner, actAs, addMember };
  }
});
