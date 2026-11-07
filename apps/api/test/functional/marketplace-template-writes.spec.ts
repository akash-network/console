import { faker } from "@faker-js/faker";
import { asc, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateModerationStatus, TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const MEBIBYTE = 1024 ** 2;
const GIBIBYTE = 1024 ** 3;

describe("Marketplace template writes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("answers 404 on every write when template_marketplace is off", async () => {
    const { team, project, owner, actAs } = await setup({ isMarketplaceOn: false });
    const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
    const asOwner = actAs(owner);

    const responses = await Promise.all([
      asOwner("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl() } } }),
      asOwner(`/v1/user-templates/${template.id}/versions`, { method: "POST", body: { data: { sdl: buildSdl(), askedValues: [], baseVersion: 1 } } }),
      asOwner("/v1/user-templates"),
      asOwner(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: { title: "Renamed" } } }),
      asOwner(`/v1/user-templates/${template.id}`, { method: "DELETE" })
    ]);

    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404, 404, 404]);
    expect(await templatesAuthoredBy(owner)).toEqual([expect.objectContaining({ id: template.id, title: template.title })]);
    expect(await versionsOf(template.id)).toHaveLength(1);
  });

  it("answers 401 to a caller without a session", async () => {
    const { team, project, owner, read } = await setup();
    const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

    const responses = await Promise.all([
      read("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl() } } }),
      read("/v1/user-templates"),
      read(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: { title: "Renamed" } } }),
      read(`/v1/user-templates/${template.id}`, { method: "DELETE" })
    ]);

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401]);
    expect(await storedTemplate(template.id)).toMatchObject({ title: template.title });
  });

  describe("GET /v1/user-templates", () => {
    it("lists the active organization's templates the caller can read, newest update first", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const member = await addMember("member", "member");
      const otherProject = await seedProject({ organizationId: team.id });
      const { user: stranger, organization: otherTeam, project: otherTeamProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const organizationWide = await seedTemplate({
        author: owner,
        organizationId: team.id,
        projectId: otherProject.id,
        visibility: "organization",
        updatedAt: new Date("2026-11-01T00:00:00Z")
      });
      const own = await seedTemplate({ author: member, organizationId: team.id, projectId: project.id, updatedAt: new Date("2026-11-03T00:00:00Z") });
      await Promise.all([
        seedTemplate({ author: owner, organizationId: team.id, projectId: otherProject.id, updatedAt: new Date("2026-11-04T00:00:00Z") }),
        seedTemplate({ author: stranger, organizationId: otherTeam.id, projectId: otherTeamProject.id, visibility: "organization" }),
        seedTemplate({ author: member, organizationId: team.id, projectId: project.id, moderationStatus: "removed" })
      ]);
      const [organizationWideVersion] = await versionsOf(organizationWide.id);

      const response = await actAs(member)("/v1/user-templates");

      expect(response.status).toBe(200);
      const { data } = (await response.json()) as { data: { id: string; canEdit: boolean }[] };
      expect(data.map(({ id, canEdit }) => ({ id, canEdit }))).toEqual([
        { id: own.id, canEdit: true },
        { id: organizationWide.id, canEdit: false }
      ]);
      expect(data[1]).toEqual({
        id: organizationWide.id,
        title: organizationWide.title,
        summary: null,
        icon: null,
        categories: [],
        visibility: "organization",
        isListed: true,
        moderationStatus: "active",
        projectId: otherProject.id,
        copiedFromId: null,
        updatedAt: "2026-11-01T00:00:00.000Z",
        currentVersion: { version: 1, status: "live", createdAt: organizationWideVersion.createdAt.toISOString() },
        lastEditedBy: { username: owner.username },
        canEdit: false
      });
    });

    it("lists only organization-wide templates when asked for that visibility", async () => {
      const { team, project, owner, actAs } = await setup();
      const [organizationWide] = await Promise.all([
        seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "organization" }),
        seedTemplate({ author: owner, organizationId: team.id, projectId: project.id })
      ]);

      const response = await actAs(owner)("/v1/user-templates?visibility=organization");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [expect.objectContaining({ id: organizationWide.id, visibility: "organization" })] });
    });

    it("lists only the templates of the project asked for", async () => {
      const { team, project, owner, actAs } = await setup();
      const otherProject = await seedProject({ organizationId: team.id });
      const [inProject] = await Promise.all([
        seedTemplate({ author: owner, organizationId: team.id, projectId: project.id }),
        seedTemplate({ author: owner, organizationId: team.id, projectId: otherProject.id })
      ]);

      const response = await actAs(owner)(`/v1/user-templates?projectId=${project.id}`);

      expect(await response.json()).toEqual({ data: [expect.objectContaining({ id: inProject.id, projectId: project.id })] });
    });

    it("names no version or editor for a legacy template saved without a version", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, withoutVersion: true });

      const response = await actAs(owner)("/v1/user-templates");

      expect(await response.json()).toEqual({ data: [expect.objectContaining({ id: template.id, currentVersion: null, lastEditedBy: null, canEdit: true })] });
    });

    it("lists only organization-wide templates to a billing member, read-only", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const billing = await addMember("billing", null);
      const [organizationWide] = await Promise.all([
        seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "organization" }),
        seedTemplate({ author: owner, organizationId: team.id, projectId: project.id })
      ]);

      const response = await actAs(billing)("/v1/user-templates");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [expect.objectContaining({ id: organizationWide.id, canEdit: false })] });
    });
  });

  describe("GET /v1/user-templates/{id}", () => {
    it("reports isFavorite and projectId on the template, withholding the project outside its organization", async () => {
      const { team, project, owner, actAs, read } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public" });
      const { user: outsider, organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      await Promise.all([seedFavorite(owner, template.id), seedFavorite(outsider, template.id)]);

      const responses = await Promise.all([
        actAs(owner)(`/v1/user-templates/${template.id}`),
        actAs(outsider, { organizationId: otherTeam.id })(`/v1/user-templates/${template.id}`),
        read(`/v1/user-templates/${template.id}`)
      ]);

      expect(await Promise.all(responses.map(response => response.json()))).toEqual([
        { data: expect.objectContaining({ id: template.id, projectId: project.id, isFavorite: true }) },
        { data: expect.objectContaining({ id: template.id, projectId: null, isFavorite: true }) },
        { data: expect.objectContaining({ id: template.id, projectId: null, isFavorite: false }) }
      ]);
    });

    it("names the template a copy was made from only to a caller who may read that one", async () => {
      const { team, project, owner, actAs, read } = await setup();
      const { user: stranger, organization: otherTeam, project: otherTeamProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const hiddenSource = await seedTemplate({ author: stranger, organizationId: otherTeam.id, projectId: otherTeamProject.id });
      const publicSource = await seedTemplate({ author: stranger, organizationId: otherTeam.id, projectId: otherTeamProject.id, visibility: "public" });
      const [copyOfHidden, copyOfPublic] = await Promise.all(
        [hiddenSource, publicSource].map(source =>
          seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public", copiedFromId: source.id })
        )
      );

      const responses = await Promise.all([
        actAs(owner)(`/v1/user-templates/${copyOfHidden.id}`),
        read(`/v1/user-templates/${copyOfHidden.id}`),
        actAs(stranger, { organizationId: otherTeam.id })(`/v1/user-templates/${copyOfHidden.id}`),
        read(`/v1/user-templates/${copyOfPublic.id}`)
      ]);

      expect((await Promise.all(responses.map(response => response.json()))).map(({ data }) => data.copiedFromId)).toEqual([
        null,
        null,
        hiddenSource.id,
        publicSource.id
      ]);
    });
  });

  describe("PATCH /v1/user-templates/{id}", () => {
    it("updates title, summary, icon, categories and visibility, keeping isPublic false", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const asOwner = actAs(owner);
      const settings = { title: "  Renamed  ", summary: "  Serves the web  ", icon: "rocket", categories: ["AI - GPU", "Tools"], visibility: "organization" };

      const response = await asOwner(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: settings } });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: expect.objectContaining({
          id: template.id,
          title: "Renamed",
          summary: "Serves the web",
          icon: "rocket",
          categories: ["AI - GPU", "Tools"],
          visibility: "organization",
          isListed: true,
          projectId: project.id,
          canEdit: true
        })
      });
      expect(await storedTemplate(template.id)).toMatchObject({
        title: "Renamed",
        summary: "Serves the web",
        icon: "rocket",
        categories: ["AI - GPU", "Tools"],
        visibility: "organization",
        isPublic: false,
        isListed: true,
        sdl: template.sdl
      });
      const legacy = await asOwner(`/v1/user/template/${template.id}`);
      expect(await legacy.json()).toMatchObject({ id: template.id, title: "Renamed", isPublic: false });
    });

    it("changes only the settings sent and clears the summary and icon with null or an empty summary", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({
        author: owner,
        organizationId: team.id,
        projectId: project.id,
        summary: "Serves the web",
        icon: "rocket",
        categories: ["Tools"]
      });
      const asOwner = actAs(owner);

      const cleared = await asOwner(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: { summary: "  ", icon: null } } });
      const afterClear = await storedTemplate(template.id);
      const nulled = await asOwner(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: { summary: null, categories: [] } } });

      expect([cleared.status, nulled.status]).toEqual([200, 200]);
      expect(afterClear).toMatchObject({ title: template.title, summary: null, icon: null, categories: ["Tools"], visibility: "private" });
      expect(await storedTemplate(template.id)).toMatchObject({ title: template.title, summary: null, icon: null, categories: [], visibility: "private" });
    });

    it.each<[string, Record<string, unknown>]>([
      ["public visibility", { visibility: "public" }],
      ["an icon outside the catalog", { icon: "unicorn" }],
      ["a category outside the catalog", { categories: ["Gaming"] }],
      ["four categories", { categories: ["AI - CPU", "AI - GPU", "Blockchain", "Tools"] }],
      ["a category twice", { categories: ["Tools", "Tools"] }],
      ["a blank title", { title: "   " }],
      ["a title of 81 characters", { title: "a".repeat(81) }],
      ["a summary of 201 characters", { summary: "a".repeat(201) }],
      ["no setting at all", {}]
    ])("refuses %s", async (_case, settings) => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: settings } });

      expect(response.status).toBe(400);
      expect(await storedTemplate(template.id)).toEqual(template);
    });

    it("ignores the project, organization and listing a caller sends", async () => {
      const { team, project, owner, actAs } = await setup();
      const otherProject = await seedProject({ organizationId: team.id });
      const { organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}`, {
        method: "PATCH",
        body: { data: { title: "Renamed", projectId: otherProject.id, organizationId: otherTeam.id, isListed: false } }
      });

      expect(response.status).toBe(200);
      expect(await storedTemplate(template.id)).toMatchObject({ title: "Renamed", projectId: project.id, organizationId: team.id, isListed: true });
    });

    it("refuses opening a legacy-saved template to the organization while it holds a plaintext registry password", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({
        author: owner,
        organizationId: team.id,
        projectId: project.id,
        sdl: buildSdl({ credentials: ["host: docker.io", "username: me", "password: hunter2"] })
      });
      const issue = 'Service "web" carries a registry password; save it as a secret instead';

      const response = await actAs(owner)(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: { visibility: "organization" } } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_invalid", data: { issues: [issue] } });
      expect(await storedTemplate(template.id)).toEqual(template);
    });

    it("takes a legacy public template back to organization visibility", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public", isListed: false });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: { visibility: "organization" } } });

      expect(response.status).toBe(200);
      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "organization", isPublic: false, isListed: false });
    });

    it("refuses a viewer's change with 403 and an outsider's with 404", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "organization" });
      const viewer = await addMember("member", "viewer");
      const { user: outsider, organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const body = { data: { title: "Renamed" } };

      const responses = await Promise.all([
        actAs(viewer)(`/v1/user-templates/${template.id}`, { method: "PATCH", body }),
        actAs(outsider, { organizationId: otherTeam.id })(`/v1/user-templates/${template.id}`, { method: "PATCH", body })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([403, 404]);
      expect(await responses[0].json()).toMatchObject({ message: "You cannot change this template" });
      expect(await storedTemplate(template.id)).toEqual(template);
    });
  });

  describe("DELETE /v1/user-templates/{id}", () => {
    it("deletes a template with its versions and favorites", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "organization" });
      const kept = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const member = await addMember("member", "member");
      await Promise.all([seedFavorite(owner, template.id), seedFavorite(member, template.id), seedFavorite(owner, kept.id)]);

      const response = await actAs(owner)(`/v1/user-templates/${template.id}`, { method: "DELETE" });

      expect(response.status).toBe(204);
      expect(await storedTemplate(template.id)).toBeUndefined();
      expect(await versionsOf(template.id)).toEqual([]);
      expect(await favoritesOf(template.id)).toEqual([]);
      expect(await storedTemplate(kept.id)).toEqual(kept);
      expect(await favoritesOf(kept.id)).toHaveLength(1);
    });

    it("refuses a viewer's delete with 403 and an outsider's with 404", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const viewer = await addMember("member", "viewer");
      const { user: outsider, organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });

      const responses = await Promise.all([
        actAs(viewer)(`/v1/user-templates/${template.id}`, { method: "DELETE" }),
        actAs(outsider, { organizationId: otherTeam.id })(`/v1/user-templates/${template.id}`, { method: "DELETE" })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([403, 404]);
      expect(await storedTemplate(template.id)).toEqual(template);
      expect(await versionsOf(template.id)).toHaveLength(1);
    });
  });

  describe("POST /v1/user/saveTemplate on a template saved with asked values or a readme", () => {
    it("carries the readme and asked values into the version a legacy save adds", async () => {
      const { team, project, owner, actAs } = await setup();
      const askedValues = [secretAskedValue("API_KEY")];
      const template = await seedTemplate({
        author: owner,
        organizationId: team.id,
        projectId: project.id,
        sdl: buildSdl({ env: ["API_KEY"] }),
        readme: "# Readme",
        askedValues
      });
      const sdl = buildSdl({ env: ["API_KEY"], count: 3 });

      const response = await actAs(owner)("/v1/user/saveTemplate", { method: "POST", body: legacySaveOf(template, sdl) });

      expect(response.status).toBe(200);
      expect((await versionsOf(template.id)).map(({ version, sdl, readme, askedValues }) => ({ version, sdl, readme, askedValues }))).toEqual([
        { version: 1, sdl: buildSdl({ env: ["API_KEY"] }), readme: "# Readme", askedValues },
        { version: 2, sdl, readme: "# Readme", askedValues }
      ]);
    });

    it("refuses a legacy save that puts a plaintext value in a secret the template asks for, saving nothing", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({
        author: owner,
        organizationId: team.id,
        projectId: project.id,
        sdl: buildSdl({ env: ["API_KEY"] }),
        askedValues: [secretAskedValue("API_KEY")]
      });
      const issue = 'Variable "API_KEY" is a secret, so web.env.API_KEY must not carry a value';

      const response = await actAs(owner)("/v1/user/saveTemplate", {
        method: "POST",
        body: { ...legacySaveOf(template, buildSdl({ env: ["API_KEY=hunter2"] })), title: "Renamed" }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_invalid", message: issue, data: { issues: [issue] } });
      expect(await versionsOf(template.id)).toHaveLength(1);
      expect(await storedTemplate(template.id)).toEqual(template);
    });

    it("keeps the legacy save of a template without asked values or a readme unchecked", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const sdl = buildSdl({ credentials: ["host: docker.io", "username: me", "password: hunter2"] });

      const response = await actAs(owner)("/v1/user/saveTemplate", { method: "POST", body: legacySaveOf(template, sdl) });

      expect(response.status).toBe(200);
      expect((await versionsOf(template.id)).map(({ sdl, readme, askedValues }) => ({ sdl, readme, askedValues }))).toEqual([
        { sdl: buildSdl(), readme: null, askedValues: [] },
        { sdl, readme: null, askedValues: [] }
      ]);
    });
  });

  describe("with an API key bound to a project", () => {
    it("refuses filing a template in another project", async () => {
      const { team, project, owner } = await setup();
      const otherProject = await seedProject({ organizationId: team.id });
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: project.id });

      const response = await requestWithKey(apiKey, "/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Web", sdl: buildSdl(), projectId: otherProject.id } }
      });

      expect(response.status).toBe(404);
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });

    it("refuses changing templates of another project, by 403 when it may read them and 404 when not", async () => {
      const { team, project, owner } = await setup();
      const otherProject = await seedProject({ organizationId: team.id });
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: project.id });
      const [readable, unreadable] = await Promise.all([
        seedTemplate({ author: owner, organizationId: team.id, projectId: otherProject.id, visibility: "organization" }),
        seedTemplate({ author: owner, organizationId: team.id, projectId: otherProject.id })
      ]);
      const statuses: number[][] = [];

      for (const { id } of [readable, unreadable]) {
        statuses.push([
          (
            await requestWithKey(apiKey, `/v1/user-templates/${id}/versions`, {
              method: "POST",
              body: { data: { sdl: buildSdl({ count: 3 }), askedValues: [], baseVersion: 1 } }
            })
          ).status,
          (await requestWithKey(apiKey, `/v1/user-templates/${id}`, { method: "PATCH", body: { data: { title: "Renamed" } } })).status,
          (await requestWithKey(apiKey, `/v1/user-templates/${id}`, { method: "DELETE" })).status
        ]);
      }

      expect(statuses).toEqual([
        [403, 403, 403],
        [404, 404, 404]
      ]);
      expect(await Promise.all([readable, unreadable].map(({ id }) => storedTemplate(id)))).toEqual([readable, unreadable]);
    });
  });

  describe("outside the active organization", () => {
    it.each<[string, (id: string) => { path: string; method: string; body?: unknown }, number]>([
      ["a settings change", id => ({ path: `/v1/user-templates/${id}`, method: "PATCH", body: { data: { title: "Renamed" } } }), 200],
      ["a delete", id => ({ path: `/v1/user-templates/${id}`, method: "DELETE" }), 204],
      [
        "a new version",
        id => ({ path: `/v1/user-templates/${id}/versions`, method: "POST", body: { data: { sdl: buildSdl({ count: 3 }), askedValues: [], baseVersion: 1 } } }),
        201
      ]
    ])("allows %s in legacy mode on the caller's personal template only", async (_case, requestFor, allowedStatus) => {
      const { team, project, owner, actAs } = await setup({ isOrganizationsOn: false });
      const {
        user: author,
        organization: personal,
        project: personalProject
      } = await seedOrganizationWithOwner({
        type: "personal",
        user: createSignedUpUserInput()
      });
      await seedOrganizationMember({ organizationId: team.id, userId: author.id, role: "member" });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: author.id, role: "member" });
      const personalTemplate = await seedTemplate({ author, organizationId: personal.id, projectId: personalProject.id });
      const teamTemplates = await Promise.all([
        seedTemplate({ author, organizationId: team.id, projectId: project.id }),
        seedTemplate({ author: owner, organizationId: team.id, projectId: project.id })
      ]);
      const asAuthor = actAs(author);
      const statuses: number[] = [];

      for (const { id } of [personalTemplate, ...teamTemplates]) {
        const { path, ...init } = requestFor(id);
        statuses.push((await asAuthor(path, init)).status);
      }

      expect(statuses).toEqual([allowedStatus, 403, 404]);
      expect(await Promise.all(teamTemplates.map(({ id }) => storedTemplate(id)))).toEqual(teamTemplates);
      expect(await Promise.all(teamTemplates.map(async ({ id }) => (await versionsOf(id)).length))).toEqual([1, 1]);
    });

    it("offers an edit in legacy mode on the caller's personal template only, not their team template", async () => {
      const { team, project, actAs } = await setup({ isOrganizationsOn: false });
      const {
        user: author,
        organization: personal,
        project: personalProject
      } = await seedOrganizationWithOwner({
        type: "personal",
        user: createSignedUpUserInput()
      });
      await seedOrganizationMember({ organizationId: team.id, userId: author.id, role: "member" });
      const templates = [
        await seedTemplate({ author, organizationId: personal.id, projectId: personalProject.id }),
        await seedTemplate({ author, organizationId: team.id, projectId: project.id })
      ];
      const asAuthor = actAs(author);

      const responses = await Promise.all(templates.map(({ id }) => asAuthor(`/v1/user-templates/${id}`)));

      expect(responses.map(({ status }) => status)).toEqual([200, 200]);
      expect(await Promise.all(responses.map(response => response.json()))).toEqual([
        { data: expect.objectContaining({ id: templates[0].id, canEdit: true }) },
        { data: expect.objectContaining({ id: templates[1].id, canEdit: false }) }
      ]);
    });

    it("tells the author to switch to the template's organization", async () => {
      const { team, project, actAs } = await setup({ isOrganizationsOn: false });
      const { user: author } = await seedOrganizationWithOwner({ type: "personal", user: createSignedUpUserInput() });
      const template = await seedTemplate({ author, organizationId: team.id, projectId: project.id });

      const response = await actAs(author)(`/v1/user-templates/${template.id}`, { method: "DELETE" });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "organization_forbidden", message: "Switch to the template's organization to change it" });
    });

    it("refuses changing a template filed in no organization", async () => {
      const { actAs } = await setup({ isOrganizationsOn: false });
      const { user: author } = await seedOrganizationWithOwner({ type: "personal", user: createSignedUpUserInput() });
      const template = await seedTemplate({ author });
      const asAuthor = actAs(author);

      const responses = await Promise.all([
        asAuthor(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: { title: "Renamed" } } }),
        asAuthor(`/v1/user-templates/${template.id}`, { method: "DELETE" }),
        asAuthor(`/v1/user-templates/${template.id}/versions`, {
          method: "POST",
          body: { data: { sdl: buildSdl({ count: 3 }), askedValues: [], baseVersion: 1 } }
        })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([403, 403, 403]);
      expect(await storedTemplate(template.id)).toEqual(template);
      expect(await versionsOf(template.id)).toHaveLength(1);
    });
  });

  describe("POST /v1/user-templates", () => {
    it("creates a private template in the caller's filing project with version 1", async () => {
      const { team, project, actAs, addMember } = await setup();
      const member = await addMember("member", "member");
      const sdl = buildSdl();

      const response = await actAs(member)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "  Web server  ", summary: "Serves the web", sdl, readme: "# Web" } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string; currentVersion: { id: string } } };
      expect(data).toEqual({
        id: expect.any(String),
        title: "Web server",
        summary: "Serves the web",
        icon: null,
        categories: [],
        visibility: "private",
        isListed: true,
        isOfficial: false,
        moderationStatus: "active",
        projectId: project.id,
        copiedFromId: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        author: { username: member.username },
        publisher: { name: team.name, slug: team.slug, type: "team" },
        currentVersion: {
          id: expect.any(String),
          templateId: data.id,
          version: 1,
          sdl,
          readme: "# Web",
          askedValues: [],
          resources: { cpu: 1, memoryBytes: 1024 * MEBIBYTE, storageBytes: 2 * GIBIBYTE },
          status: "live",
          changes: ["first_version"],
          createdBy: { username: member.username },
          createdAt: expect.any(String)
        },
        canEdit: true,
        isFavorite: false
      });
      expect(await storedTemplate(data.id)).toMatchObject({
        visibility: "private",
        isPublic: false,
        isListed: true,
        authorId: member.id,
        userId: member.userId,
        organizationId: team.id,
        projectId: project.id,
        currentVersionId: data.currentVersion.id,
        title: "Web server",
        summary: "Serves the web",
        sdl,
        description: "# Web",
        cpu: 1000,
        ram: 1024 * MEBIBYTE,
        storage: 2 * GIBIBYTE
      });
    });

    it("files the template in the project the caller names and saves its asked values", async () => {
      const { team, owner, actAs } = await setup();
      const otherProject = await seedProject({ organizationId: team.id });
      const askedValues = [textAskedValue("GREETING")];

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Web", sdl: buildSdl(), askedValues, projectId: otherProject.id } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(await storedTemplate(data.id)).toMatchObject({ projectId: otherProject.id, summary: null, description: "" });
      expect(await versionsOf(data.id)).toEqual([expect.objectContaining({ version: 1, askedValues, readme: null })]);
    });

    it("asks for a project when the filing project is ambiguous", async () => {
      const { team, actAs, addMember } = await setup();
      const member = await addMember("member", "member");
      const secondProject = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: secondProject.id, userId: member.id, role: "member" });

      const response = await actAs(member)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl() } } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "project_required" });
      expect(await templatesAuthoredBy(member)).toEqual([]);
    });

    it.each<[string, Record<string, unknown>]>([
      ["a title of 81 characters", { title: "a".repeat(81) }],
      ["a blank title", { title: "   " }],
      ["a summary of 201 characters", { summary: "a".repeat(201) }],
      ["a readme of 50,001 characters", { readme: "a".repeat(50_001) }],
      ["an SDL over 128 KiB", { sdl: `${buildSdl()}\n#${"a".repeat(128 * 1024)}` }]
    ])("refuses %s", async (_case, fields) => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl(), ...fields } } });

      expect(response.status).toBe(400);
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });

    it.each<[string, { env?: string[]; credentials?: string[] }, ReturnType<typeof secretAskedValue>[], string]>([
      [
        "a plaintext value bound to a secret",
        { env: ["API_KEY=hunter2"] },
        [secretAskedValue("API_KEY")],
        'Variable "API_KEY" is a secret, so web.env.API_KEY must not carry a value'
      ],
      [
        "a secret reference no variable asks for",
        { env: ["API_KEY=ac-secret://API_KEY"] },
        [],
        "web.env.API_KEY references a secret that no variable asks the deployer for"
      ],
      [
        "a plaintext registry password",
        { credentials: ["host: docker.io", "username: me", "password: hunter2"] },
        [],
        'Service "web" carries a registry password; save it as a secret instead'
      ]
    ])("refuses %s, naming the key, service and env", async (_case, sdlParts, askedValues, issue) => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Web", sdl: buildSdl(sdlParts), askedValues } }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_invalid", message: issue, data: { issues: [issue] } });
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });

    it.each<[string, string, RegExp]>([
      ["a map-form env holding a secret-looking value", buildSdl({ envMapping: ["API_KEY: hunter2"] }), /"env" at "\/services\/web" should be array/],
      [
        "an unquoted numeric registry password",
        buildSdl({ credentials: ["host: docker.io", "username: me", "password: 12345"] }),
        /"password" at "\/services\/web\/credentials" should be string/
      ],
      ["an SDL that is not YAML", "services: [web", /^The SDL could not be read: /],
      ["an SDL that is not a mapping", "just text", /^The SDL could not be read$/],
      ["an SDL without services", "version: '2.0'\nservices: {}", /^The SDL defines no services$/],
      ["an SDL with an unknown reference kind", buildSdl({ env: ["API_KEY=ac-vault://API_KEY"] }), /ac-vault/]
    ])("refuses %s before checking its values", async (_case, sdl, issue) => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl } } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_invalid", data: { issues: expect.arrayContaining([expect.stringMatching(issue)]) } });
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });

    it("refuses an asked value bound to a service the SDL does not define", async () => {
      const { owner, actAs } = await setup();
      const askedValue = { ...textAskedValue("GREETING"), bindings: [{ service: "api", env: "GREETING" }] };

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Web", sdl: buildSdl(), askedValues: [askedValue] } }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "template_invalid",
        data: { issues: ['Variable "GREETING" fills in service "api", which the SDL does not define'] }
      });
    });

    it("ignores the visibility, organization and official flag a caller sends", async () => {
      const { team, owner, actAs } = await setup();
      const { organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Web", sdl: buildSdl(), visibility: "public", organizationId: otherTeam.id, isOfficial: true } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(await storedTemplate(data.id)).toMatchObject({ visibility: "private", isPublic: false, organizationId: team.id, isOfficial: false });
    });

    it("accepts a body with every field at its cap", async () => {
      const { owner, actAs } = await setup();
      const sdl = `${buildSdl()}\n#${"é".repeat(128 * 1024 - buildSdl().length - 2)}`;
      const readme = "\u0001".repeat(50_000);
      const askedValues = Array.from({ length: 50 }, (_, index) => ({ ...textAskedValue(`VALUE_${index}`), help: "\u0001".repeat(500) }));
      const body = { data: { title: "a".repeat(80), summary: "a".repeat(200), sdl, readme, askedValues } };

      const response = await actAs(owner)("/v1/user-templates", { method: "POST", body });

      expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(512 * 1024);
      expect(response.status).toBe(201);
    });

    it("stores the icon and categories sent", async () => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Web", sdl: buildSdl(), icon: "rocket", categories: ["Tools", "AI - GPU"] } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string; icon: string; categories: string[] } };
      expect(data).toMatchObject({ icon: "rocket", categories: ["Tools", "AI - GPU"] });
      expect(await storedTemplate(data.id)).toMatchObject({ icon: "rocket", categories: ["Tools", "AI - GPU"] });
    });

    it.each<[string, Record<string, unknown>]>([
      ["an icon outside the catalog", { icon: "unicorn" }],
      ["a category outside the catalog", { categories: ["Gaming"] }],
      ["four categories", { categories: ["AI - CPU", "AI - GPU", "Blockchain", "Tools"] }],
      ["a category twice", { categories: ["Tools", "Tools"] }]
    ])("refuses creating with %s", async (_case, fields) => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl(), ...fields } } });

      expect(response.status).toBe(400);
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });

    it("reports where a YAML error is without echoing the SDL around it", async () => {
      const { owner, actAs } = await setup();
      const sdl = ["services:", "  web:", "    env:", "      - API_KEY=hunter2-secret", "    image: [nginx"].join("\n");

      const response = await actAs(owner)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl } } });

      expect(response.status).toBe(400);
      const body = await response.text();
      expect(JSON.parse(body)).toMatchObject({
        code: "template_invalid",
        data: { issues: ["The SDL could not be read: unexpected end of the stream within a flow collection (line 6, column 1)"] }
      });
      expect(body).not.toContain("hunter2");
    });

    it("refuses a viewer's template, finding no project it may file in, without storing it", async () => {
      const { project, actAs, addMember } = await setup();
      const viewer = await addMember("member", "viewer");
      const asViewer = actAs(viewer);

      const responses = [
        await asViewer("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl() } } }),
        await asViewer("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl(), projectId: project.id } } })
      ];

      expect(responses.map(({ status }) => status)).toEqual([400, 404]);
      expect(await responses[0].json()).toMatchObject({ code: "project_required" });
      expect(await templatesAuthoredBy(viewer)).toEqual([]);
    });

    it("records the template a copy was made from when the caller can read it", async () => {
      const { owner, actAs } = await setup();
      const original = await seedTemplate({ author: null, visibility: "public" });

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Copy", sdl: buildSdl(), copiedFromId: original.id } }
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { copiedFromId: original.id } });
    });

    it("refuses copying from a template the caller cannot read", async () => {
      const { owner, actAs } = await setup();
      const { user: stranger, organization, project } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const original = await seedTemplate({ author: stranger, organizationId: organization.id, projectId: project.id });

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Copy", sdl: buildSdl(), copiedFromId: original.id } }
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ message: "Template not found" });
      expect(await templatesAuthoredBy(owner)).toEqual([]);
    });
  });

  describe("POST /v1/user-templates/{id}/versions", () => {
    it("saves a new version, mirrors the legacy columns and keeps earlier versions unchanged", async () => {
      const { team, project, actAs, addMember } = await setup();
      const editor = await addMember("member", "member");
      const template = await seedTemplate({ author: editor, organizationId: team.id, projectId: project.id });
      const [firstBefore] = await versionsOf(template.id);
      const sdl = buildSdl({ image: "nginx:1.27", count: 3 });

      const response = await actAs(editor)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl, readme: "# Second", askedValues: [textAskedValue("GREETING")], baseVersion: 1 } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(data).toEqual({
        id: expect.any(String),
        templateId: template.id,
        version: 2,
        sdl,
        readme: "# Second",
        askedValues: [textAskedValue("GREETING")],
        resources: { cpu: 1.5, memoryBytes: 1536 * MEBIBYTE, storageBytes: 3 * GIBIBYTE },
        status: "live",
        changes: ["image_tag_changed", "asked_value_added", "readme_changed"],
        createdBy: { username: editor.username },
        createdAt: expect.any(String)
      });
      const [firstAfter, second] = await versionsOf(template.id);
      expect(firstAfter).toEqual(firstBefore);
      expect(second.id).toBe(data.id);
      expect(await storedTemplate(template.id)).toMatchObject({
        currentVersionId: data.id,
        sdl,
        description: "# Second",
        cpu: 1500,
        ram: 1536 * MEBIBYTE,
        storage: 3 * GIBIBYTE,
        visibility: "private",
        isPublic: false
      });
    });

    it("carries the readme forward when a new version omits it, and clears it with null", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, readme: "# First" });
      const asOwner = actAs(owner);

      const carried = await asOwner(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ count: 1 }), askedValues: [], baseVersion: 1 } }
      });
      const cleared = await asOwner(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ count: 2 }), readme: null, askedValues: [], baseVersion: 2 } }
      });

      expect([carried.status, cleared.status]).toEqual([201, 201]);
      expect(await carried.json()).toMatchObject({ data: { version: 2, readme: "# First" } });
      expect(await cleared.json()).toMatchObject({ data: { version: 3, readme: null } });
      expect((await versionsOf(template.id)).map(({ readme }) => readme)).toEqual(["# First", "# First", null]);
      expect(await storedTemplate(template.id)).toMatchObject({ description: "" });
      const described = await asOwner(`/v1/user-templates/${template.id}`);
      expect(await described.json()).toMatchObject({ data: { currentVersion: { version: 3, readme: null } } });
    });

    it("saves version 1 on a legacy template that has none yet, carrying its description forward", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({
        author: owner,
        organizationId: team.id,
        projectId: project.id,
        description: "Legacy description",
        withoutVersion: true
      });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ count: 3 }), askedValues: [], baseVersion: 1 } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(data).toMatchObject({ version: 1, readme: "Legacy description" });
      expect(await storedTemplate(template.id)).toMatchObject({ currentVersionId: data.id, description: "Legacy description", sdl: buildSdl({ count: 3 }) });
    });

    it("asks for the base version once the template has one", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ count: 3 }), askedValues: [] } }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_base_version_required" });
      expect(await versionsOf(template.id)).toHaveLength(1);
    });

    it("saves version 1 on a legacy template without a base version", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, withoutVersion: true });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ count: 3 }), askedValues: [] } }
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { version: 1 } });
    });

    it("refuses a new version from a stale base with 409 and saves nothing", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const asOwner = actAs(owner);
      const saved = await asOwner(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ count: 3 }), askedValues: [], baseVersion: 1 } }
      });

      const responses = await Promise.all(
        [1, 5].map(baseVersion =>
          asOwner(`/v1/user-templates/${template.id}/versions`, {
            method: "POST",
            body: { data: { sdl: buildSdl({ count: 4 }), askedValues: [], baseVersion } }
          })
        )
      );

      expect(saved.status).toBe(201);
      expect(responses.map(({ status }) => status)).toEqual([409, 409]);
      expect(await Promise.all(responses.map(response => response.json()))).toEqual([
        expect.objectContaining({ code: "template_version_conflict" }),
        expect.objectContaining({ code: "template_version_conflict" })
      ]);
      expect(await versionsOf(template.id)).toHaveLength(2);
      expect(await storedTemplate(template.id)).toMatchObject({ sdl: buildSdl({ count: 3 }) });
    });

    it("refuses a viewer's new version with 403 and an outsider's with 404", async () => {
      const { team, project, owner, actAs, addMember } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const viewer = await addMember("member", "viewer");
      const { user: outsider, organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const body = { data: { sdl: buildSdl({ count: 3 }), askedValues: [], baseVersion: 1 } };

      const responses = await Promise.all([
        actAs(viewer)(`/v1/user-templates/${template.id}/versions`, { method: "POST", body }),
        actAs(outsider, { organizationId: otherTeam.id })(`/v1/user-templates/${template.id}/versions`, { method: "POST", body }),
        actAs(owner)(`/v1/user-templates/${faker.string.uuid()}/versions`, { method: "POST", body })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([403, 404, 404]);
      expect(await responses[0].json()).toMatchObject({ message: "You cannot change this template" });
      expect(await versionsOf(template.id)).toHaveLength(1);
    });

    it("refuses a new version whose SDL leaks a secret", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ env: ["API_KEY=hunter2"] }), askedValues: [secretAskedValue("API_KEY")], baseVersion: 1 } }
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "template_invalid",
        data: { issues: ['Variable "API_KEY" is a secret, so web.env.API_KEY must not carry a value'] }
      });
      expect(await versionsOf(template.id)).toHaveLength(1);
    });

    it("leaves the legacy read of the template coherent", async () => {
      const { team, project, owner, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const asOwner = actAs(owner);
      const sdl = buildSdl({ image: "nginx:1.27" });

      const saved = await asOwner(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl, readme: "# Updated", askedValues: [], baseVersion: 1 } }
      });
      const legacy = await asOwner(`/v1/user/template/${template.id}`);

      expect(saved.status).toBe(201);
      expect(legacy.status).toBe(200);
      expect(await legacy.json()).toMatchObject({ id: template.id, sdl, description: "# Updated", cpu: 1000, ram: 1024 * MEBIBYTE, storage: 2 * GIBIBYTE });
    });
  });

  function buildSdl({
    image = "nginx:1.25",
    env,
    envMapping,
    credentials,
    count = 2
  }: { image?: string; env?: string[]; envMapping?: string[]; credentials?: string[]; count?: number } = {}) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      `    image: ${image}`,
      ...(env ? ["    env:", ...env.map(entry => `      - ${entry}`)] : []),
      ...(envMapping ? ["    env:", ...envMapping.map(entry => `      ${entry}`)] : []),
      ...(credentials ? ["    credentials:", ...credentials.map(entry => `      ${entry}`)] : []),
      "    expose:",
      "      - port: 80",
      "        as: 80",
      "        to:",
      "          - global: true",
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
      "  placement:",
      "    dcloud:",
      "      pricing:",
      "        web:",
      "          denom: uakt",
      "          amount: 1000",
      "deployment:",
      "  web:",
      "    dcloud:",
      "      profile: web",
      `      count: ${count}`
    ].join("\n");
  }

  function textAskedValue(key: string) {
    return { key, label: key, type: "text" as const, required: false, bindings: [{ service: "web", env: key }] };
  }

  function secretAskedValue(key: string) {
    return { key, label: key, type: "secret" as const, required: true, bindings: [{ service: "web", env: key }] };
  }

  async function seedTemplate(input: {
    author: UserOutput | null;
    organizationId?: string;
    projectId?: string;
    visibility?: TemplateVisibility;
    readme?: string;
    description?: string;
    withoutVersion?: boolean;
    sdl?: string;
    askedValues?: AskedValue[];
    copiedFromId?: string;
    moderationStatus?: TemplateModerationStatus;
    isListed?: boolean;
    summary?: string;
    icon?: string;
    categories?: string[];
    updatedAt?: Date;
  }) {
    const {
      author,
      readme,
      description = readme,
      withoutVersion = false,
      visibility = "private",
      updatedAt,
      sdl = buildSdl(),
      askedValues,
      ...template
    } = input;
    const templates = resolveTable("Templates");
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const [row] = await db
      .insert(templates)
      .values({
        ...template,
        sdl,
        visibility,
        isPublic: visibility === "public",
        userId: author?.userId ?? null,
        authorId: author?.id ?? null,
        title: faker.lorem.words(3),
        description,
        cpu: 1000,
        ram: 1024 * MEBIBYTE,
        storage: 2 * GIBIBYTE
      })
      .returning();
    if (!withoutVersion) {
      await container.resolve(TemplateVersionRepository).appendVersion({ templateId: row.id, sdl, readme, askedValues, createdById: author?.id });
    }
    if (updatedAt) {
      await db.update(templates).set({ updatedAt }).where(eq(templates.id, row.id));
    }

    return await storedTemplate(row.id);
  }

  function legacySaveOf(template: { id: string; title: string }, sdl: string) {
    return { id: template.id, sdl, title: template.title, cpu: 1000, ram: 1024 * MEBIBYTE, storage: 2 * GIBIBYTE, isPublic: false };
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

  async function seedFavorite(user: UserOutput, templateId: string) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("TemplateFavorites"))
      .values({ userId: user.userId!, templateId, addedDate: new Date() });
  }

  async function favoritesOf(templateId: string) {
    const favorites = resolveTable("TemplateFavorites");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(favorites).where(eq(favorites.templateId, templateId));
  }

  async function storedTemplate(id: string) {
    const templates = resolveTable("Templates");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(templates).where(eq(templates.id, id));

    return row;
  }

  async function templatesAuthoredBy(user: UserOutput) {
    const templates = resolveTable("Templates");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(templates).where(eq(templates.authorId, user.id));
  }

  async function versionsOf(templateId: string) {
    const versions = resolveTable("TemplateVersions");

    return await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .select()
      .from(versions)
      .where(eq(versions.templateId, templateId))
      .orderBy(asc(versions.version));
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setup({ isMarketplaceOn = true, isOrganizationsOn = true }: { isMarketplaceOn?: boolean; isOrganizationsOn?: boolean } = {}) {
    const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const project = await seedProject({ organizationId: team.id });
    const tokens = new Map<string, string>();
    const disabledFlags: string[] = [
      FeatureFlags.ORGANIZATIONS_ENFORCE,
      ...(isMarketplaceOn ? [] : [FeatureFlags.TEMPLATE_MARKETPLACE]),
      ...(isOrganizationsOn ? [] : [FeatureFlags.ORGANIZATIONS])
    ];

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => !disabledFlags.includes(flag));

    const request = (path: string, headers: Record<string, string>, init: { method?: string; body?: unknown }) =>
      app.request(path, {
        method: init.method ?? "GET",
        headers: { "content-type": "application/json", ...headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });

    const read = (path: string, init: { method?: string; body?: unknown } = {}) => request(path, {}, init);

    const actAs = (user: UserOutput, { organizationId = team.id }: { organizationId?: string } = {}) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);

      return (path: string, init: { method?: string; body?: unknown } = {}) =>
        request(path, { authorization: `Bearer ${token}`, "x-organization-id": organizationId }, init);
    };

    const addMember = async (role: "member" | "admin" | "billing", projectRole: "member" | "viewer" | null) => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });

      if (projectRole) {
        await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: projectRole });
      }

      return user;
    };

    return { team, project, owner, read, actAs, addMember };
  }
});
