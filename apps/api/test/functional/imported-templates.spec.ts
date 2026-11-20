import { faker } from "@faker-js/faker";
import { subDays, subHours } from "date-fns";
import { asc, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import MemoryCacheEngine from "@src/caching/memoryCacheEngine";
import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import { COMMUNITY_TEMPLATE_TERMS_VERSION } from "@src/template-marketplace/lib/publish-requirements/publish-requirements";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import {
  findStoredTemplate,
  findStoredTemplateVersions,
  seedTemplate,
  seedTemplateDeployers,
  seedTemplatePublisher,
  seedTemplateScore,
  seedTemplateUsageEvent,
  seedTemplateVersion
} from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

type TemplateInsert = ApiPgTables["Templates"]["$inferInsert"];

const SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.27.0",
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
  "      count: 1"
].join("\n");

const READ_ONLY = {
  code: "template_imported_read_only",
  message: "This template is imported from the awesome-akash repository and can only be changed there"
};

describe("Imported awesome-akash templates", () => {
  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/imported-templates/{importedRef}", () => {
    it("answers 404 while template_marketplace is off", async () => {
      const { importedRef, read } = await setup({ isMarketplaceOn: false });

      const response = await read(`/v1/imported-templates/${importedRef}`);

      expect(response.status).toBe(404);
    });

    it("describes the template imported under a gallery id to a visitor without a session, exactly as its own id does", async () => {
      const { imported, importedRef, version, team, handle, read } = await setup();

      const [byRef, byId] = await Promise.all([read(`/v1/imported-templates/${importedRef}`), read(`/v1/user-templates/${imported.id}`)]);

      expect([byRef.status, byId.status]).toEqual([200, 200]);
      const body = await byRef.json();
      expect(body).toEqual(await byId.json());
      expect(body.data).toMatchObject({
        id: imported.id,
        importedRef,
        title: "ComfyUI",
        isOfficial: true,
        isListed: true,
        visibility: "public",
        author: null,
        projectId: null,
        canEdit: false,
        publisher: { name: team.name, handle },
        currentVersion: { id: version.id, version: 1, status: "live", sdl: SDL, readme: "# ComfyUI" }
      });
    });

    it("answers 404 for a gallery id nothing was imported under and for an imported template staff hid, and 410 for one staff removed", async () => {
      const { team, read } = await setup();
      const [hiddenRef, removedRef] = [newImportedRef(), newImportedRef()];
      await Promise.all([
        seedImported({ organizationId: team.id, importedRef: hiddenRef, moderationStatus: "hidden" }),
        seedImported({ organizationId: team.id, importedRef: removedRef, moderationStatus: "removed", visibility: "private", title: "Removed one" })
      ]);

      const responses = await Promise.all([
        read(`/v1/imported-templates/${newImportedRef()}`),
        read(`/v1/imported-templates/${hiddenRef}`),
        read(`/v1/imported-templates/${removedRef}`)
      ]);

      expect(responses.map(({ status }) => status)).toEqual([404, 404, 410]);
      expect(await responses[2].json()).toMatchObject({ code: "template_removed", data: { title: "Removed one" } });
    });

    it("refuses a gallery id longer than any template can have", async () => {
      const { read } = await setup();

      const response = await read(`/v1/imported-templates/${"a".repeat(256)}`);

      expect(response.status).toBe(400);
    });
  });

  describe("writes", () => {
    it.each(["the owner of the organization that owns it", "an admin of that organization", "a member of another organization"] as const)(
      "refuses every change of an imported template to %s with a conflict of its own, and changes nothing",
      async caller => {
        const { imported, version, owner, team, actAs, addMember } = await setup();
        const { user: stranger, organization: elsewhere } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
        const act = {
          "the owner of the organization that owns it": () => actAs(owner, team.id),
          "an admin of that organization": async () => actAs(await addMember("admin"), team.id),
          "a member of another organization": () => actAs(stranger, elsewhere.id)
        }[caller];
        const asCaller = await act();
        const before = await findStoredTemplate(imported.id);

        const responses = await Promise.all([
          asCaller(`/v1/user-templates/${imported.id}`, { method: "PATCH", body: { data: { title: "Renamed" } } }),
          asCaller(`/v1/user-templates/${imported.id}`, { method: "PATCH", body: { data: { visibility: "private" } } }),
          asCaller(`/v1/user-templates/${imported.id}`, { method: "PATCH", body: { data: { summary: "Mine now", icon: "rocket", categories: ["Tools"] } } }),
          asCaller(`/v1/user-templates/${imported.id}/versions`, { method: "POST", body: { data: { sdl: SDL, askedValues: [], baseVersion: 1 } } }),
          asCaller(`/v1/user-templates/${imported.id}/publish-readiness`),
          asCaller(`/v1/user-templates/${imported.id}/publish`, { method: "POST", body: { data: { acceptedTermsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION } } }),
          asCaller(`/v1/user-templates/${imported.id}`, { method: "DELETE" })
        ]);

        expect(responses.map(({ status }) => status)).toEqual([409, 409, 409, 409, 409, 409, 409]);
        expect(await Promise.all(responses.map(response => response.json()))).toEqual(responses.map(() => expect.objectContaining(READ_ONLY)));
        expect(await findStoredTemplate(imported.id)).toEqual(before);
        expect((await findStoredTemplateVersions(imported.id)).map(({ id }) => id)).toEqual([version.id]);
      }
    );

    it("answers a visitor without a session 401 before anything is said of the template", async () => {
      const { imported, read } = await setup();

      const responses = await Promise.all([
        read(`/v1/user-templates/${imported.id}`, { method: "PATCH", body: { data: { title: "Renamed" } } }),
        read(`/v1/user-templates/${imported.id}`, { method: "DELETE" })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([401, 401]);
    });

    it("offers the organization's own members no edit of it, on its page and in their list of templates", async () => {
      const { imported, owner, team, actAs } = await setup();
      const asOwner = actAs(owner, team.id);

      const [page, list] = await Promise.all([asOwner(`/v1/user-templates/${imported.id}`), asOwner("/v1/user-templates")]);

      expect((await page.json()).data).toMatchObject({ id: imported.id, canEdit: false });
      expect((await list.json()).data).toEqual([expect.objectContaining({ id: imported.id, canEdit: false })]);
    });

    it("leaves it as it is when the legacy routes are asked to describe, save or delete it, since nobody authored it", async () => {
      const { imported, version, owner, team, actAs } = await setup();
      const asOwner = actAs(owner, team.id);
      const before = await findStoredTemplate(imported.id);

      await asOwner("/v1/user/saveTemplateDesc", { method: "POST", body: { id: imported.id, description: "Mine now" } });
      await asOwner(`/v1/user/deleteTemplate/${imported.id}`, { method: "DELETE" });
      const saved = await asOwner("/v1/user/saveTemplate", {
        method: "POST",
        body: { id: imported.id, sdl: SDL, title: "Mine now", cpu: 500, ram: 1024, storage: 1024, isPublic: false }
      });

      expect(await findStoredTemplate(imported.id)).toEqual(before);
      expect((await findStoredTemplateVersions(imported.id)).map(({ id }) => id)).toEqual([version.id]);
      expect(saved.status).toBe(200);
      expect(await saved.text()).not.toBe(imported.id);
    });

    it("lets anyone copy it into a private template of their own and keep it among their favorites", async () => {
      const { imported, importedRef, version } = await setup();
      const { user: forker, organization: forkerOrganization, project } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const asForker = actingAs(forker, forkerOrganization.id);

      const copied = await asForker("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "My ComfyUI", copiedFromId: imported.id, projectId: project.id } }
      });
      const favorited = await asForker(`/v1/user/addFavoriteTemplate/${imported.id}`, { method: "POST" });

      expect(copied.status).toBe(201);
      expect((await copied.json()).data).toMatchObject({
        title: "My ComfyUI",
        visibility: "private",
        importedRef: null,
        isOfficial: false,
        canEdit: true,
        copiedFrom: { id: imported.id, title: "ComfyUI" },
        currentVersion: { sdl: SDL, readme: "# ComfyUI" }
      });
      expect(favorited.status).toBeLessThan(300);
      const page = await asForker(`/v1/imported-templates/${importedRef}`);
      expect((await page.json()).data).toMatchObject({ isFavorite: true, usage: { favorites: 1 } });
      expect(await findStoredUsageEvents(imported.id)).toEqual([]);
      expect(await findStoredUsageEvents(importedRef)).toEqual([
        expect.objectContaining({
          source: "awesome_akash",
          action: "fork",
          userId: forker.id,
          organizationId: forkerOrganization.id,
          templateVersionId: version.id
        }),
        expect.objectContaining({ source: "awesome_akash", action: "favorite", userId: forker.id, templateVersionId: version.id })
      ]);
    });
  });

  describe("GET /v1/community-templates", () => {
    it("lists an imported template as an Official card with its gallery id, next to the awesome-akash usage the old list still reads", async () => {
      const { imported, importedRef, version, team, handle, read } = await setup();
      const community = await seedTemplate({ organizationId: team.id, visibility: "public", publishedAt: subDays(new Date(), 3), title: "Community one" });
      await seedTemplateVersion({ templateId: community.id });
      await seedTemplateDeployers(importedRef, 2, { source: "awesome_akash" });

      const response = await read("/v1/community-templates");

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(cardsOf(body, [imported.id, community.id])).toEqual([
        expect.objectContaining({
          id: imported.id,
          importedRef,
          title: "ComfyUI",
          summary: "A node based interface",
          icon: "box",
          categories: ["AI - GPU"],
          isOfficial: true,
          publisher: { name: team.name, handle, verified: false },
          versionCount: 1,
          usage: { deploys: 2, stillUpAfter24h: null, forks: 0 }
        }),
        expect.objectContaining({ id: community.id, importedRef: null, isOfficial: false })
      ]);
      expect(body.data.officialUsage[importedRef]).toMatchObject({ deploys: 2 });
      expect(version.templateId).toBe(imported.id);
    });

    it("counts the usage recorded before the import, the organization's own, and what is recorded after it, on the card, the page and the score", async () => {
      const { imported, importedRef, version, owner, team, read } = await setup();
      const beforeTheImport = subDays(new Date(), 200);
      const dayOld = subHours(new Date(), 25);
      await seedTemplateDeployers(importedRef, 4, { source: "awesome_akash", createdAt: beforeTheImport });
      await seedTemplateDeployers(importedRef, 3, { source: "awesome_akash", organizationId: team.id, userId: owner.id });
      await seedTemplateDeployers(importedRef, 2, { source: "awesome_akash", templateVersionId: version.id });
      await seedTemplateDeployers(importedRef, 5, { source: "awesome_akash", action: "lease_created", createdAt: dayOld });
      await seedTemplateDeployers(importedRef, 4, { source: "awesome_akash", action: "still_running_24h" });
      await seedTemplateDeployers(importedRef, 6, { source: "awesome_akash", network: "sandbox" });
      await seedTemplateUsageEvent({ source: "awesome_akash", templateRef: importedRef, action: "fork" });
      await seedTemplateScore({ source: "awesome_akash", templateRef: importedRef, popularScore: 41.5, trendingScore: 0.25, isTrending: true });
      await seedTemplateScore({ templateRef: imported.id, popularScore: 1, trendingScore: 0, isTrending: false });

      const [gallery, page, versions] = await Promise.all([
        read("/v1/community-templates"),
        read(`/v1/imported-templates/${importedRef}`),
        read(`/v1/user-templates/${imported.id}/versions`)
      ]);

      const { data } = await gallery.json();
      expect(cardsOf({ data }, [imported.id])).toEqual([
        expect.objectContaining({
          id: imported.id,
          usage: { deploys: 9, stillUpAfter24h: 0.8, forks: 1 },
          scores: { popular: 41.5, trending: 0.25, isTrending: true }
        })
      ]);
      expect(data.officialUsage[importedRef]).toEqual({
        deploys: 9,
        stillUpAfter24h: 0.8,
        forks: 1,
        scores: { popular: 41.5, trending: 0.25, isTrending: true }
      });
      expect((await page.json()).data.usage).toMatchObject({ deploys: 9, stillUpAfter24h: 0.8, forks: 1 });
      expect((await versions.json()).data).toEqual([expect.objectContaining({ id: version.id, deploys: 2 })]);
    });

    it("leaves out an imported template that left the gallery, which still opens by its gallery id", async () => {
      const { team, read } = await setup();
      const goneRef = newImportedRef();
      const gone = await seedImported({ organizationId: team.id, importedRef: goneRef, isListed: false });

      const [gallery, page] = await Promise.all([read("/v1/community-templates"), read(`/v1/imported-templates/${goneRef}`)]);

      expect(cardsOf(await gallery.json(), [gone.id])).toEqual([]);
      expect((await page.json()).data).toMatchObject({ id: gone.id, isListed: false, importedRef: goneRef });
    });
  });

  const tokens = new Map<string, string>();

  function cardsOf(body: { data: { templates: { id: string }[] } }, ids: string[]) {
    return body.data.templates.filter(card => ids.includes(card.id));
  }

  async function findStoredUsageEvents(templateRef: string) {
    const events = resolveTable("TemplateUsageEvents");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(events).where(eq(events.templateRef, templateRef)).orderBy(asc(events.createdAt));
  }

  function newImportedRef() {
    return `akash-network-awesome-akash-${faker.string.alphanumeric(16)}`;
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  function request(path: string, headers: Record<string, string>, init: { method?: string; body?: unknown }) {
    return app.request(path, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", ...headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
  }

  function actingAs(user: UserOutput, organizationId: string) {
    const token = faker.string.alphanumeric(40);
    tokens.set(token, user.userId!);

    return (path: string, init: { method?: string; body?: unknown } = {}) =>
      request(path, { authorization: `Bearer ${token}`, "x-organization-id": organizationId }, init);
  }

  async function seedImported(overrides: Partial<TemplateInsert> & Pick<TemplateInsert, "organizationId" | "importedRef">) {
    const template = await seedTemplate({
      title: "ComfyUI",
      summary: "A node based interface",
      icon: "box",
      categories: ["AI - GPU"],
      visibility: "public",
      isListed: true,
      isOfficial: true,
      publishedAt: subDays(new Date(), 1),
      sdl: SDL,
      description: "# ComfyUI",
      importedContentHash: "a".repeat(64),
      ...overrides
    });
    const version = await seedTemplateVersion({ templateId: template.id, sdl: SDL, readme: "# ComfyUI" });

    return { ...(await findStoredTemplate(template.id)), version };
  }

  async function setup({ isMarketplaceOn = true }: { isMarketplaceOn?: boolean } = {}) {
    MemoryCacheEngine.clearAllCaches();
    const { user: owner, organization: team } = await seedOrganizationWithOwner({
      user: createSignedUpUserInput(),
      name: `Akash ${faker.string.alphanumeric(8)}`
    });
    const { handle } = await seedTemplatePublisher({ organizationId: team.id });
    const importedRef = newImportedRef();
    const { version, ...imported } = await seedImported({ organizationId: team.id, importedRef });

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => isMarketplaceOn || flag !== FeatureFlags.TEMPLATE_MARKETPLACE);

    const read = (path: string, init: { method?: string; body?: unknown } = {}) => request(path, {}, init);
    const addMember = async (role: "member" | "admin") => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });

      return user;
    };

    return { team, owner, handle, imported, importedRef, version, read, actAs: actingAs, addMember };
  }
});
