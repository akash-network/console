import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { ProjectRole } from "@src/organization/model-schemas/project-member/project-member.schema";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("Templates in organizations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/user/saveTemplate", () => {
    it.each<[OrganizationRole, ProjectRole | null, number]>([
      ["owner", null, 200],
      ["admin", null, 200],
      ["member", "member", 200],
      ["member", "viewer", 404],
      ["viewer", "member", 403],
      ["billing", null, 403]
    ])("answers a %s with project role %s saving a template into a project with %s", async (role, projectRole, status) => {
      const { team, project, actAs, addMember } = await setup();
      const caller = await addMember(role, projectRole);

      const response = await actAs(caller)("/v1/user/saveTemplate", { method: "POST", body: { ...buildTemplate(), projectId: project.id } });

      expect(response.status).toBe(status);
      expect(await templatesOf(caller)).toEqual(status === 200 ? [expect.objectContaining({ organizationId: team.id, projectId: project.id })] : []);
    });

    it("files a template into the one project the member may write to when the request names none", async () => {
      const { project, actAs, addMember } = await setup();
      const member = await addMember("member", "member");

      const response = await actAs(member)("/v1/user/saveTemplate", { method: "POST", body: buildTemplate() });

      expect(response.status).toBe(200);
      expect(await templatesOf(member)).toEqual([expect.objectContaining({ id: await response.text(), projectId: project.id })]);
    });

    it("asks a member who may write to no project to choose one", async () => {
      const { actAs, addMember } = await setup();
      const member = await addMember("member", "viewer");

      const response = await actAs(member)("/v1/user/saveTemplate", { method: "POST", body: buildTemplate() });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "project_required" });
    });
  });

  describe("changing a template", () => {
    it.each<[ProjectRole, number, number]>([
      ["member", 200, 204],
      ["viewer", 403, 403]
    ])("answers the author holding project role %s with %s when saving and %s when describing or deleting", async (projectRole, saveStatus, status) => {
      const { team, project, actAs, addMember } = await setup();
      const member = await addMember("member", projectRole);
      const template = await seedTemplate({ userId: member.userId!, organizationId: team.id, projectId: project.id });
      const description = faker.lorem.sentence();

      const saved = await actAs(member)("/v1/user/saveTemplate", { method: "POST", body: { ...buildTemplate(), id: template.id } });
      const described = await actAs(member)("/v1/user/saveTemplateDesc", { method: "POST", body: { id: template.id, description } });
      const deleted = await actAs(member)(`/v1/user/deleteTemplate/${template.id}`, { method: "DELETE" });

      expect([saved.status, described.status, deleted.status]).toEqual([saveStatus, status, status]);
      expect(await templatesOf(member)).toEqual(status === 204 ? [] : [expect.objectContaining({ id: template.id, title: template.title, description: null })]);
    });
  });

  describe("reading templates", () => {
    it("shows a member their own templates only in the projects they are granted", async () => {
      const { team, project, defaultProject, actAs, addMember } = await setup();
      const member = await addMember("member", "viewer");
      const granted = await seedTemplate({ userId: member.userId!, organizationId: team.id, projectId: project.id });
      const notGranted = await seedTemplate({ userId: member.userId!, organizationId: team.id, projectId: defaultProject.id });

      const reads = await Promise.all([granted, notGranted].map(({ id }) => actAs(member)(`/v1/user/template/${id}`)));
      const listed = await actAs(member)(`/v1/user/templates/${member.username}`);

      expect(reads.map(({ status }) => status)).toEqual([200, 404]);
      expect(idsOf(await listed.json())).toEqual([granted.id]);
    });

    it("keeps public templates readable by a billing member", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const billing = await addMember("billing", null);
      const publicTemplate = await seedTemplate({ userId: owner.userId!, organizationId: team.id, projectId: project.id, isPublic: true });

      const read = await actAs(billing)(`/v1/user/template/${publicTemplate.id}`);
      const listed = await actAs(billing)(`/v1/user/templates/${billing.username}`);

      expect(read.status).toBe(200);
      expect(await listed.json()).toEqual([]);
    });
  });

  describe("with an API key bound to a project", () => {
    it("files, lists and changes templates in the key's project only", async () => {
      const { team, project, defaultProject, owner } = await setup();
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: project.id });
      const elsewhere = await seedTemplate({ userId: owner.userId!, organizationId: team.id, projectId: defaultProject.id });

      const saved = await requestWithKey(apiKey, "/v1/user/saveTemplate", { method: "POST", body: buildTemplate() });
      const listed = await requestWithKey(apiKey, `/v1/user/templates/${owner.username}`);
      const changedElsewhere = await requestWithKey(apiKey, "/v1/user/saveTemplateDesc", { method: "POST", body: { id: elsewhere.id, description: "x" } });

      const savedId = await saved.text();
      expect(await templateRow(savedId)).toMatchObject({ projectId: project.id });
      expect(idsOf(await listed.json())).toEqual([savedId]);
      expect(changedElsewhere.status).toBe(403);
    });
  });

  describe("in a personal organization", () => {
    it("saves, changes and deletes templates in the default project as before", async () => {
      const { actAs } = await setup();
      const { user, organization, project } = await seedOrganizationWithOwner({ type: "personal", user: createSignedUpUserInput() });
      const act = actAs(user, { inTeam: false });

      const saved = await act("/v1/user/saveTemplate", { method: "POST", body: buildTemplate() });
      const id = await saved.text();
      const described = await act("/v1/user/saveTemplateDesc", { method: "POST", body: { id, description: "updated" } });
      const stored = await templateRow(id);
      const deleted = await act(`/v1/user/deleteTemplate/${id}`, { method: "DELETE" });

      expect([saved.status, described.status, deleted.status]).toEqual([200, 204, 204]);
      expect(stored).toMatchObject({ organizationId: organization.id, projectId: project.id, description: "updated" });
      expect(await templateRow(id)).toBeUndefined();
    });
  });

  function buildTemplate() {
    return { sdl: "version: '2.0'", title: faker.lorem.words(3), cpu: 500, ram: 268435456, storage: 536870912, isPublic: false };
  }

  function idsOf(body: unknown) {
    return (body as { id: string }[]).map(({ id }) => id);
  }

  async function seedTemplate(input: { userId: string; organizationId: string; projectId: string; isPublic?: boolean }) {
    const [template] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({ isPublic: false, ...input, title: faker.lorem.words(3), sdl: "version: '2.0'", cpu: 1000, ram: 1024, storage: 1024 })
      .returning();

    return template;
  }

  async function templatesOf(user: UserOutput) {
    const templates = resolveTable("Templates");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(templates).where(eq(templates.userId, user.userId!));
  }

  async function templateRow(id: string) {
    const templates = resolveTable("Templates");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(templates).where(eq(templates.id, id));

    return row;
  }

  async function seedApiKey(input: { userId: string; organizationId: string; projectId: string }) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      ...input,
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: "ci"
    });

    return apiKey;
  }

  function requestWithKey(apiKey: string, path: string, init: { method?: string; body?: unknown } = {}) {
    return app.request(path, {
      method: init.method ?? "GET",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() };
  }

  async function setup() {
    const { user: owner, organization: team, project: defaultProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const project = await seedProject({ organizationId: team.id });
    const tokens = new Map<string, string>();

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);

    const actAs = (user: UserOutput, { inTeam = true }: { inTeam?: boolean } = {}) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);
      const organizationHeader: Record<string, string> = inTeam ? { "x-organization-id": team.id } : {};

      return (path: string, init: { method?: string; body?: unknown } = {}) =>
        app.request(path, {
          method: init.method ?? "GET",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...organizationHeader },
          body: init.body === undefined ? undefined : JSON.stringify(init.body)
        });
    };

    const addMember = async (role: OrganizationRole, projectRole: ProjectRole | null) => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });

      if (projectRole) {
        await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: projectRole });
      }

      return user;
    };

    return { team, project, defaultProject, owner, actAs, addMember };
  }
});
