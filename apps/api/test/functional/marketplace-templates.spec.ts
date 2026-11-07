import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateModerationStatus, TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

type Reader = "project member" | "organization member outside the project" | "member of another organization" | "visitor without a session";

const SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          size: 1Gi",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 2"
].join("\n");

describe("Marketplace templates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/user-templates/{id}", () => {
    it("answers 404 when template_marketplace is off", async () => {
      const { team, project, owner, actAs, read } = await setup({ isMarketplaceOn: false });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public" });

      const responses = await Promise.all([
        read(`/v1/user-templates/${template.id}`),
        actAs(owner)(`/v1/user-templates/${template.id}`),
        read(`/v1/user-templates/${template.id}/versions`),
        read(`/v1/user-templates/${template.id}/versions/1`)
      ]);

      expect(responses.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
    });

    it.each<[TemplateVisibility, Reader, number]>([
      ["private", "project member", 200],
      ["private", "organization member outside the project", 404],
      ["private", "member of another organization", 404],
      ["private", "visitor without a session", 404],
      ["organization", "project member", 200],
      ["organization", "organization member outside the project", 200],
      ["organization", "member of another organization", 404],
      ["organization", "visitor without a session", 404],
      ["public", "project member", 200],
      ["public", "organization member outside the project", 200],
      ["public", "member of another organization", 200],
      ["public", "visitor without a session", 200]
    ])("serves a %s template to a %s with %s", async (visibility, reader, status) => {
      const { team, project, owner, readAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility });

      const response = await (await readAs(reader))(`/v1/user-templates/${template.id}`);

      expect(response.status).toBe(status);
    });

    it("describes a template with its author, publisher and current version", async () => {
      const { team, project, actAs, addMember } = await setup();
      const author = await addMember("member");
      const template = await seedTemplate({ author, organizationId: team.id, projectId: project.id, visibility: "organization" });
      const version = await container.resolve(TemplateVersionRepository).appendVersion({
        templateId: template.id,
        sdl: SDL,
        readme: "# Readme",
        resources: { cpu: 1, memoryBytes: 2, storageBytes: 3 },
        createdById: author.id
      });

      const response = await actAs(author)(`/v1/user-templates/${template.id}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: template.id,
          title: template.title,
          summary: null,
          icon: null,
          categories: [],
          visibility: "organization",
          isListed: true,
          isOfficial: false,
          moderationStatus: "active",
          copiedFromId: null,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
          author: { username: author.username },
          publisher: { name: team.name, slug: team.slug, type: "team" },
          currentVersion: {
            id: version.id,
            templateId: template.id,
            version: 1,
            sdl: SDL,
            readme: "# Readme",
            askedValues: [],
            resources: { cpu: 1, memoryBytes: 2, storageBytes: 3 },
            status: "live",
            createdById: author.id,
            createdAt: version.createdAt.toISOString()
          },
          canEdit: true
        }
      });
    });

    it("tells a viewer of the project it cannot edit the template", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const viewer = await addMember("member", "viewer");
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "private" });

      const response = await actAs(viewer)(`/v1/user-templates/${template.id}`);

      expect(await response.json()).toMatchObject({ data: { id: template.id, canEdit: false } });
    });

    it("serves a migrated template whose author deleted their account, read-only", async () => {
      const { owner, actAs, read } = await setup();
      const template = await seedTemplate({ author: null, visibility: "public" });

      const responses = await Promise.all([read(`/v1/user-templates/${template.id}`), actAs(owner, { inTeam: false })(`/v1/user-templates/${template.id}`)]);

      const readOnly = { data: expect.objectContaining({ id: template.id, author: null, publisher: null, canEdit: false }) };
      expect(responses.map(({ status }) => status)).toEqual([200, 200]);
      expect(await Promise.all(responses.map(response => response.json()))).toEqual([readOnly, readOnly]);
    });

    it("hides a hidden public template from outsiders but not from its organization", async () => {
      const { team, project, owner, actAs, readAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public", moderationStatus: "hidden" });

      const [outsider, visitor, member] = await Promise.all([
        (await readAs("member of another organization"))(`/v1/user-templates/${template.id}`),
        (await readAs("visitor without a session"))(`/v1/user-templates/${template.id}`),
        actAs(owner)(`/v1/user-templates/${template.id}`)
      ]);

      expect([outsider.status, visitor.status, member.status]).toEqual([404, 404, 200]);
      expect(await member.json()).toMatchObject({ data: { moderationStatus: "hidden" } });
    });

    it("hides a removed template from everyone", async () => {
      const { team, project, owner, actAs, read } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public", moderationStatus: "removed" });

      const responses = await Promise.all([
        read(`/v1/user-templates/${template.id}`),
        actAs(owner)(`/v1/user-templates/${template.id}`),
        actAs(owner)(`/v1/user-templates/${template.id}/versions`),
        actAs(owner)(`/v1/user-templates/${template.id}/versions/1`)
      ]);

      expect(responses.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
    });

    it("answers 404 for a template that does not exist", async () => {
      const { read } = await setup();

      const response = await read(`/v1/user-templates/${faker.string.uuid()}`);

      expect(response.status).toBe(404);
    });

    it("falls back to the legacy description and the SDL's hardware for a migrated version", async () => {
      const { read } = await setup();
      const template = await seedTemplate({ author: null, visibility: "public", description: "Legacy description", sdl: SDL });
      await container.resolve(TemplateVersionRepository).appendVersion({ templateId: template.id, sdl: SDL });

      const response = await read(`/v1/user-templates/${template.id}`);

      expect(await response.json()).toMatchObject({
        data: { currentVersion: { readme: "Legacy description", resources: { cpu: 1, memoryBytes: 2 * 512 * 1024 ** 2, storageBytes: 2 * 1024 ** 3 } } }
      });
    });

    it("keeps a template in its organization, crediting its author, after the author leaves the organization", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const author = await addMember("member");
      const template = await seedTemplate({ author, organizationId: team.id, projectId: project.id, visibility: "organization" });

      const left = await actAs(author)(`/v1/organizations/${team.id}/membership`, { method: "DELETE" });
      const response = await actAs(owner)(`/v1/user-templates/${template.id}`);

      expect(left.status).toBe(204);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        data: { id: template.id, author: { username: author.username }, publisher: { name: team.name, slug: team.slug, type: "team" } }
      });
    });
  });

  describe("GET /v1/user-templates/{id}/versions", () => {
    it("lists versions newest first and reads one by number", async () => {
      const { read } = await setup();
      const template = await seedTemplate({ author: null, visibility: "public" });
      const versions = container.resolve(TemplateVersionRepository);
      const first = await versions.appendVersion({ templateId: template.id, sdl: "version: '2.0'", readme: "first" });
      const second = await versions.appendVersion({ templateId: template.id, sdl: "version: '2.1'", readme: "second" });

      const listed = await read(`/v1/user-templates/${template.id}/versions`);
      const one = await read(`/v1/user-templates/${template.id}/versions/1`);

      expect(listed.status).toBe(200);
      expect(await listed.json()).toEqual({
        data: [second, first].map(({ id, version, createdAt }) => ({
          id,
          templateId: template.id,
          version,
          resources: null,
          status: "live",
          createdById: null,
          createdAt: createdAt.toISOString()
        }))
      });
      expect(one.status).toBe(200);
      expect(await one.json()).toEqual({
        data: {
          id: first.id,
          templateId: template.id,
          version: 1,
          sdl: "version: '2.0'",
          readme: "first",
          askedValues: [],
          resources: null,
          status: "live",
          createdById: null,
          createdAt: first.createdAt.toISOString()
        }
      });
    });

    it("answers 404 for a version number the template does not have", async () => {
      const { read } = await setup();
      const template = await seedTemplate({ author: null, visibility: "public" });
      await container.resolve(TemplateVersionRepository).appendVersion({ templateId: template.id, sdl: SDL });

      const [missing, invalid] = await Promise.all([read(`/v1/user-templates/${template.id}/versions/2`), read(`/v1/user-templates/${template.id}/versions/0`)]);

      expect([missing.status, invalid.status]).toEqual([404, 400]);
    });

    it("answers 404 for the versions of a template the reader cannot see", async () => {
      const { team, project, owner, read } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "private" });
      await container.resolve(TemplateVersionRepository).appendVersion({ templateId: template.id, sdl: SDL });

      const responses = await Promise.all([read(`/v1/user-templates/${template.id}/versions`), read(`/v1/user-templates/${template.id}/versions/1`)]);

      expect(responses.map(({ status }) => status)).toEqual([404, 404]);
    });
  });

  async function seedTemplate(input: {
    author: UserOutput | null;
    organizationId?: string;
    projectId?: string;
    visibility: TemplateVisibility;
    moderationStatus?: TemplateModerationStatus;
    description?: string;
    sdl?: string;
  }) {
    const { author, ...template } = input;
    const [row] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({
        sdl: "version: '2.0'",
        ...template,
        userId: author?.userId ?? null,
        authorId: author?.id ?? null,
        isPublic: input.visibility === "public",
        title: faker.lorem.words(3),
        cpu: 1000,
        ram: 1024,
        storage: 1024
      })
      .returning();

    return row;
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setup({ isMarketplaceOn = true }: { isMarketplaceOn?: boolean } = {}) {
    const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const project = await seedProject({ organizationId: team.id });
    const tokens = new Map<string, string>();
    const disabledFlags: string[] = [FeatureFlags.ORGANIZATIONS_ENFORCE, ...(isMarketplaceOn ? [] : [FeatureFlags.TEMPLATE_MARKETPLACE])];

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => !disabledFlags.includes(flag));

    const read = (path: string) => app.request(path);

    const actAs = (user: UserOutput, { inTeam = true, organizationId = team.id }: { inTeam?: boolean; organizationId?: string } = {}) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);
      const organizationHeader: Record<string, string> = inTeam ? { "x-organization-id": organizationId } : {};

      return (path: string, init: { method?: string } = {}) =>
        app.request(path, { method: init.method ?? "GET", headers: { authorization: `Bearer ${token}`, ...organizationHeader } });
    };

    const addMember = async (role: "member" | "admin", projectRole: "member" | "viewer" | null = "member") => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });

      if (projectRole) {
        await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: projectRole });
      }

      return user;
    };

    const readAs = async (reader: Reader) => {
      if (reader === "visitor without a session") return read;
      if (reader === "project member") return actAs(await addMember("member"));
      if (reader === "organization member outside the project") return actAs(await addMember("member", null));

      const { user, organization } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });

      return actAs(user, { organizationId: organization.id });
    };

    return { team, project, owner, read, actAs, addMember, readAs };
  }
});
