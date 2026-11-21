import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import {
  findStoredTemplate,
  findStoredTemplateVersions,
  seedTemplate,
  seedTemplateFavorite,
  seedTemplatePublisher,
  seedTemplateReport,
  seedTemplateVersion
} from "@test/seeders/db/template.seeder";

type ListBody = { data: { id: string }[] };
type TemplateBody = { data: { id: string; copiedFromId: string | null } };

const REMOVED = { code: "template_removed", message: "This template was removed" };

describe("Marketplace template removal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("DELETE /v1/user-templates/{id}", () => {
    it("deletes a template that was never public, whose link then answers 404", async () => {
      const { owner, team, actAs, read, seedOwnTemplate } = await setup();
      const { template } = await seedOwnTemplate();
      const asOwner = actAs(owner, team.id);

      const deleted = await asOwner(`/v1/user-templates/${template.id}`, { method: "DELETE" });
      const after = await Promise.all([read(`/v1/user-templates/${template.id}`), asOwner(`/v1/user-templates/${template.id}`)]);

      expect(deleted.status).toBe(204);
      expect(after.map(({ status }) => status)).toEqual([404, 404]);
      expect(await findStoredTemplate(template.id)).toBeUndefined();
      expect(await findStoredTemplateVersions(template.id)).toEqual([]);
    });

    it("keeps the link of a public template as a removed page that tells its title to everyone, and drops what it held", async () => {
      const { owner, team, outsider, outsiderTeam, actAs, read, seedOwnTemplate } = await setup();
      const { template, version } = await seedOwnTemplate({ title: "Llama 3.1 Chat", visibility: "public", publishedAt: new Date() });
      const report = await seedTemplateReport({ templateId: template.id, templateVersionId: version.id });
      await seedTemplateFavorite(template.id, outsider.userId!);

      const deleted = await actAs(owner, team.id)(`/v1/user-templates/${template.id}`, { method: "DELETE" });
      const after = await Promise.all([
        read(`/v1/user-templates/${template.id}`),
        actAs(outsider, outsiderTeam.id)(`/v1/user-templates/${template.id}`),
        actAs(owner, team.id)(`/v1/user-templates/${template.id}`)
      ]);

      expect(deleted.status).toBe(204);
      expect(after.map(({ status }) => status)).toEqual([410, 410, 410]);
      expect(await Promise.all(after.map(response => response.json()))).toEqual([
        { ...REMOVED, data: { title: "Llama 3.1 Chat" }, error: expect.any(String), type: expect.any(String) },
        { ...REMOVED, data: { title: "Llama 3.1 Chat" }, error: expect.any(String), type: expect.any(String) },
        { ...REMOVED, data: { title: "Llama 3.1 Chat" }, error: expect.any(String), type: expect.any(String) }
      ]);
      expect(await findStoredTemplate(template.id)).toMatchObject({
        id: template.id,
        title: "Llama 3.1 Chat",
        moderationStatus: "removed",
        removedBy: "owner",
        removedAt: expect.any(Date),
        sdl: "",
        description: null,
        summary: null,
        visibility: "private",
        isPublic: false
      });
      expect(await findStoredTemplateVersions(template.id)).toMatchObject([{ id: version.id, sdl: "", readme: null, askedValues: [] }]);
      expect(await storedReportsOf(template.id)).toEqual([report]);
      expect(await storedFavoritesOf(template.id)).toEqual([]);
    });

    it("keeps the removed page of a template that was public once and private when deleted", async () => {
      const { owner, team, actAs, read, seedOwnTemplate } = await setup();
      const { template } = await seedOwnTemplate({ visibility: "private", publishedAt: new Date() });

      await actAs(owner, team.id)(`/v1/user-templates/${template.id}`, { method: "DELETE" });

      expect((await read(`/v1/user-templates/${template.id}`)).status).toBe(410);
    });

    it("answers 410 on every route of a removed template and changes nothing behind it", async () => {
      const { owner, team, outsider, outsiderTeam, actAs, read, seedOwnTemplate } = await setup();
      const { template } = await seedOwnTemplate({ visibility: "public", publishedAt: new Date() });
      const asOwner = actAs(owner, team.id);
      await asOwner(`/v1/user-templates/${template.id}`, { method: "DELETE" });
      const removed = await findStoredTemplate(template.id);

      const responses = await Promise.all([
        read(`/v1/user-templates/${template.id}/versions`),
        read(`/v1/user-templates/${template.id}/versions/1`),
        asOwner(`/v1/user-templates/${template.id}/publish-readiness`),
        asOwner(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: { data: { acceptedTermsVersion: "2026-11" } } }),
        asOwner(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: { title: "Back again" } } }),
        asOwner(`/v1/user-templates/${template.id}/versions`, { method: "POST", body: { data: { sdl: "version: '2.0'", askedValues: [], baseVersion: 1 } } }),
        asOwner(`/v1/user-templates/${template.id}`, { method: "DELETE" }),
        actAs(outsider, outsiderTeam.id)(`/v1/user-templates/${template.id}/reports`, { method: "POST", body: { data: { reason: "spam" } } })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([410, 410, 410, 410, 410, 410, 410, 410]);
      expect(await findStoredTemplate(template.id)).toEqual(removed);
    });

    it("leaves a removed template out of its organization's list and resolves no copy to it, while its forks keep working", async () => {
      const { owner, team, outsider, outsiderTeam, outsiderProject, actAs, seedOwnTemplate } = await setup();
      const [{ template }, { template: kept }] = await Promise.all([
        seedOwnTemplate({ visibility: "public", publishedAt: new Date() }),
        seedOwnTemplate({ visibility: "public", publishedAt: new Date() })
      ]);
      const fork = await seedTemplate({
        organizationId: outsiderTeam.id,
        projectId: outsiderProject.id,
        userId: outsider.userId,
        authorId: outsider.id,
        copiedFromId: template.id
      });
      await seedTemplateVersion({ templateId: fork.id, createdById: outsider.id });
      const asOutsider = actAs(outsider, outsiderTeam.id);
      const forkBefore = (await (await asOutsider(`/v1/user-templates/${fork.id}`)).json()) as TemplateBody;

      await actAs(owner, team.id)(`/v1/user-templates/${template.id}`, { method: "DELETE" });
      const [list, forkAfter, forkList] = await Promise.all([
        actAs(owner, team.id)("/v1/user-templates"),
        asOutsider(`/v1/user-templates/${fork.id}`),
        asOutsider("/v1/user-templates")
      ]);

      expect(forkBefore.data.copiedFromId).toBe(template.id);
      expect(((await list.json()) as ListBody).data.map(({ id }) => id)).toEqual([kept.id]);
      expect(forkAfter.status).toBe(200);
      expect(((await forkAfter.json()) as TemplateBody).data).toMatchObject({ id: fork.id, copiedFromId: null });
      expect(((await forkList.json()) as { data: { id: string; copiedFromId: string | null }[] }).data).toEqual([
        expect.objectContaining({ id: fork.id, copiedFromId: null })
      ]);
    });
  });

  describe("removed by staff or with an account", () => {
    it("answers 404, not 410, for a removed template that was never public", async () => {
      const { owner, team, actAs, read, seedOwnTemplate } = await setup();
      const { template } = await seedOwnTemplate({ visibility: "public", moderationStatus: "removed", removedBy: "staff", removedAt: new Date() });

      const responses = await Promise.all([read(`/v1/user-templates/${template.id}`), actAs(owner, team.id)(`/v1/user-templates/${template.id}`)]);

      expect(responses.map(({ status }) => status)).toEqual([404, 404]);
    });

    it("answers 410 for a template staff marked removed before its content is dropped", async () => {
      const { read, seedOwnTemplate } = await setup();
      const { template } = await seedOwnTemplate({
        title: "Totally not a miner",
        visibility: "public",
        publishedAt: new Date(),
        moderationStatus: "removed",
        removedBy: "staff",
        removedAt: new Date()
      });

      const response = await read(`/v1/user-templates/${template.id}`);

      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({ ...REMOVED, data: { title: "Totally not a miner" } });
    });

    it("answers 410 for a template whose row went with its owner's account", async () => {
      const { read } = await setup();
      const templateId = faker.string.uuid();
      await db().insert(resolveTable("TemplateTombstones")).values({ templateId, title: "Gone with its account" });

      const responses = await Promise.all([read(`/v1/user-templates/${templateId}`), read(`/v1/user-templates/${templateId}/versions`)]);

      expect(responses.map(({ status }) => status)).toEqual([410, 410]);
      expect(await responses[0].json()).toMatchObject({ ...REMOVED, data: { title: "Gone with its account" } });
    });

    it("hides a suspended publisher's public templates from everyone outside it until it is reinstated", async () => {
      const { owner, team, outsider, outsiderTeam, actAs, read, seedOwnTemplate } = await setup();
      const { template } = await seedOwnTemplate({ visibility: "public", publishedAt: new Date() });
      await seedTemplatePublisher({ organizationId: team.id, publishingSuspendedAt: new Date(), publishingSuspendedReason: "Spam" });
      const readers = () =>
        Promise.all([
          read(`/v1/user-templates/${template.id}`),
          actAs(outsider, outsiderTeam.id)(`/v1/user-templates/${template.id}`),
          read(`/v1/user/template/${template.id}`),
          actAs(owner, team.id)(`/v1/user-templates/${template.id}`)
        ]);

      const whileSuspended = await readers();
      const publishers = resolveTable("TemplatePublishers");
      await db().update(publishers).set({ publishingSuspendedAt: null, publishingSuspendedReason: null }).where(eq(publishers.organizationId, team.id));
      const onceReinstated = await readers();

      expect(whileSuspended.map(({ status }) => status)).toEqual([404, 404, 404, 200]);
      expect(onceReinstated.map(({ status }) => status)).toEqual([200, 200, 200, 200]);
    });
  });

  describe("legacy routes", () => {
    it("answer 404 for a removed template and list it nowhere", async () => {
      const { owner, team, outsider, outsiderTeam, actAs, read, seedOwnTemplate } = await setup({ isMarketplaceOn: false });
      const { template } = await seedOwnTemplate({ visibility: "public", publishedAt: new Date() });
      await seedTemplateFavorite(template.id, outsider.userId!);
      const templates = resolveTable("Templates");
      await db().update(templates).set({ moderationStatus: "removed", removedBy: "staff", removedAt: new Date() }).where(eq(templates.id, template.id));

      const [byId, byUsername, own, favorites, favorite] = await Promise.all([
        read(`/v1/user/template/${template.id}`),
        read(`/v1/user/templates/${owner.username}`),
        actAs(owner, team.id)(`/v1/user/templates/${owner.username}`),
        actAs(outsider, outsiderTeam.id)("/v1/user/favoriteTemplates"),
        actAs(owner, team.id)(`/v1/user/addFavoriteTemplate/${template.id}`, { method: "POST" })
      ]);

      expect(byId.status).toBe(404);
      expect(await byUsername.json()).toEqual([]);
      expect(await own.json()).toEqual([]);
      expect(await favorites.json()).toEqual([]);
      expect(favorite.status).toBeLessThan(500);
      expect(await storedFavoritesOf(template.id)).toHaveLength(1);
    });

    it("keep the removed page of a template that went through the publish gate when its author deletes it", async () => {
      const { owner, team, actAs, read, seedOwnTemplate } = await setup();
      const { template, version } = await seedOwnTemplate({ title: "Llama 3.1 Chat", visibility: "public", publishedAt: new Date() });

      const deleted = await actAs(owner, team.id)(`/v1/user/deleteTemplate/${template.id}`, { method: "DELETE" });
      const after = await read(`/v1/user-templates/${template.id}`);
      const deletedAgain = await actAs(owner, team.id)(`/v1/user/deleteTemplate/${template.id}`, { method: "DELETE" });

      expect(deleted.status).toBe(204);
      expect(after.status).toBe(410);
      expect(await after.json()).toMatchObject({ ...REMOVED, data: { title: "Llama 3.1 Chat" } });
      expect(deletedAgain.status).toBeLessThan(500);
      expect(await findStoredTemplate(template.id)).toMatchObject({ moderationStatus: "removed", removedBy: "owner", sdl: "", isPublic: false });
      expect(await findStoredTemplateVersions(template.id)).toMatchObject([{ id: version.id, sdl: "" }]);
    });

    it("delete a template that never went through the publish gate, with the flag off as before", async () => {
      const { owner, team, actAs, read, seedOwnTemplate } = await setup({ isMarketplaceOn: false });
      const { template } = await seedOwnTemplate({ visibility: "public" });

      const deleted = await actAs(owner, team.id)(`/v1/user/deleteTemplate/${template.id}`, { method: "DELETE" });

      expect(deleted.status).toBe(204);
      expect((await read(`/v1/user/template/${template.id}`)).status).toBe(404);
      expect(await findStoredTemplate(template.id)).toBeUndefined();
    });
  });

  function db() {
    return container.resolve<ApiPgDatabase>(POSTGRES_DB);
  }

  async function storedReportsOf(templateId: string) {
    const reports = resolveTable("TemplateReports");

    return await db().select().from(reports).where(eq(reports.templateId, templateId));
  }

  async function storedFavoritesOf(templateId: string) {
    const favorites = resolveTable("TemplateFavorites");

    return await db().select().from(favorites).where(eq(favorites.templateId, templateId));
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setup({ isMarketplaceOn = true }: { isMarketplaceOn?: boolean } = {}) {
    const { user: owner, organization: team, project } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const { user: outsider, organization: outsiderTeam, project: outsiderProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const tokens = new Map<string, string>();

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => isMarketplaceOn || flag !== FeatureFlags.TEMPLATE_MARKETPLACE);

    const request = (path: string, headers: Record<string, string>, init: { method?: string; body?: unknown }) =>
      app.request(path, {
        method: init.method ?? "GET",
        headers: { "content-type": "application/json", ...headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });

    const read = (path: string, init: { method?: string; body?: unknown } = {}) => request(path, {}, init);

    const actAs = (user: UserOutput, organizationId: string) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);

      return (path: string, init: { method?: string; body?: unknown } = {}) =>
        request(path, { authorization: `Bearer ${token}`, "x-organization-id": organizationId }, init);
    };

    const seedOwnTemplate = async (overrides: Parameters<typeof seedTemplate>[0] = {}) => {
      const template = await seedTemplate({
        organizationId: team.id,
        projectId: project.id,
        userId: owner.userId,
        authorId: owner.id,
        description: "A description",
        summary: "A summary",
        ...overrides
      });
      const version = await seedTemplateVersion({ templateId: template.id, createdById: owner.id, readme: "# Readme" });

      return { template, version };
    };

    return { owner, team, project, outsider, outsiderTeam, outsiderProject, read, actAs, seedOwnTemplate };
  }
});
