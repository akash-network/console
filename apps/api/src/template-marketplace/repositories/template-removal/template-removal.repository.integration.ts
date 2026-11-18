import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TemplateRemovalRepository } from "./template-removal.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import {
  findStoredTemplate,
  findStoredTemplateVersions,
  seedTemplate,
  seedTemplateFavorite,
  seedTemplateReport,
  seedTemplateVersion
} from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const PUBLISHED_AT = new Date("2026-11-01T10:00:00.000Z");

describe(TemplateRemovalRepository.name, () => {
  describe("remove", () => {
    it("deletes a template that was never public, with its versions and favorites", async () => {
      const { repository } = setup();
      const [template, untouched] = await Promise.all([seedTemplate(), seedTemplate()]);
      await seedTemplateVersion({ templateId: template.id });
      await seedTemplateFavorite(template.id);

      await repository.remove(template.id, "owner");

      expect(await findStoredTemplate(template.id)).toBeUndefined();
      expect(await findStoredTemplateVersions(template.id)).toEqual([]);
      expect(await favoritesOf(template.id)).toEqual([]);
      expect(await findStoredTemplate(untouched.id)).toEqual(untouched);
    });

    it("keeps the emptied row of a template that was once public, with its id and title", async () => {
      const { repository } = setup();
      const template = await seedPublishedTemplate();

      await repository.remove(template.id, "owner");

      expect(await findStoredTemplate(template.id)).toEqual({
        ...template,
        moderationStatus: "removed",
        removedAt: expect.any(Date),
        removedBy: "owner",
        sdl: "",
        description: null,
        summary: null,
        icon: null,
        categories: [],
        cpu: 0,
        ram: 0,
        storage: 0,
        visibility: "private",
        isPublic: false,
        isListed: false,
        isOfficial: false,
        isFeatured: false,
        updatedAt: expect.any(Date)
      });
    });

    it("empties every version of a once-public template and keeps what names them", async () => {
      const { repository } = setup();
      const author = await seedUser();
      const template = await seedPublishedTemplate();
      const [first, second] = [
        await seedTemplateVersion({ ...VERSION_CONTENT, templateId: template.id, version: 1, createdById: author.id, isCurrent: false }),
        await seedTemplateVersion({ ...VERSION_CONTENT, templateId: template.id, version: 2, status: "failed_checks", reviewNote: "Reviewed." })
      ];

      await repository.remove(template.id, "owner");

      expect(await findStoredTemplateVersions(template.id)).toEqual(
        [first, second].map(version => ({
          ...version,
          sdl: "",
          readme: null,
          askedValues: [],
          resources: null,
          imageDigests: {},
          checkResults: null,
          changes: null,
          reviewNote: null
        }))
      );
    });

    it("drops the favorites of a once-public template and keeps its reports and another template's favorites", async () => {
      const { repository } = setup();
      const [template, other] = await Promise.all([seedPublishedTemplate(), seedPublishedTemplate()]);
      const version = await seedTemplateVersion({ templateId: template.id });
      const report = await seedTemplateReport({ templateId: template.id, templateVersionId: version.id });
      await Promise.all([seedTemplateFavorite(template.id), seedTemplateFavorite(other.id)]);

      await repository.remove(template.id, "owner");

      expect(await favoritesOf(template.id)).toEqual([]);
      expect(await favoritesOf(other.id)).toHaveLength(1);
      expect(await reportsOf(template.id)).toEqual([report]);
      expect(await findStoredTemplate(other.id)).toEqual(other);
    });

    it("keeps when and by whom a template was first removed", async () => {
      const { repository } = setup();
      const removedAt = new Date("2026-11-10T10:00:00.000Z");
      const template = await seedPublishedTemplate({ moderationStatus: "removed", removedAt, removedBy: "staff" });

      await repository.remove(template.id, "owner");

      expect(await findStoredTemplate(template.id)).toMatchObject({ removedAt, removedBy: "staff" });
    });
  });

  describe("removeAllOfOrganization", () => {
    it("empties the organization's once-public templates, deletes the others and leaves other organizations alone", async () => {
      const { repository } = setup();
      const [organization, other] = await Promise.all([seedOrganization(), seedOrganization()]);
      const [published, unpublished, neverPublic, elsewhere, elsewherePublished] = await Promise.all([
        seedPublishedTemplate({ organizationId: organization.id }),
        seedPublishedTemplate({ organizationId: organization.id, visibility: "private", isPublic: false }),
        seedTemplate({ organizationId: organization.id }),
        seedTemplate({ organizationId: other.id }),
        seedPublishedTemplate({ organizationId: other.id })
      ]);

      await repository.removeAllOfOrganization(organization.id, "owner");

      expect(await findStoredTemplate(published.id)).toMatchObject({ moderationStatus: "removed", removedBy: "owner", sdl: "", title: published.title });
      expect(await findStoredTemplate(unpublished.id)).toMatchObject({ moderationStatus: "removed", removedBy: "owner", sdl: "" });
      expect(await findStoredTemplate(neverPublic.id)).toBeUndefined();
      expect(await findStoredTemplate(elsewhere.id)).toEqual(elsewhere);
      expect(await findStoredTemplate(elsewherePublished.id)).toEqual(elsewherePublished);
    });
  });

  describe("emptyRemoved", () => {
    it("empties a template staff marked removed and keeps what the admin app recorded", async () => {
      const { repository } = setup();
      const removedAt = new Date("2026-11-10T10:00:00.000Z");
      const template = await seedPublishedTemplate({ moderationStatus: "removed", removedAt, removedBy: "staff" });
      await seedTemplateVersion({ ...VERSION_CONTENT, templateId: template.id });

      const isEmptied = await repository.emptyRemoved(template.id, "owner");

      expect(isEmptied).toBe(true);
      expect(await findStoredTemplate(template.id)).toMatchObject({ sdl: "", description: null, removedAt, removedBy: "staff" });
      expect(await findStoredTemplateVersions(template.id)).toMatchObject([{ sdl: "", readme: null, askedValues: [] }]);
    });

    it("says who removed a template marked removed without saying so, and when", async () => {
      const { repository } = setup();
      const template = await seedTemplate({ moderationStatus: "removed" });

      await repository.emptyRemoved(template.id, "staff");

      expect(await findStoredTemplate(template.id)).toMatchObject({ removedAt: expect.any(Date), removedBy: "staff", sdl: "" });
    });

    it("leaves a template nobody marked removed as it is", async () => {
      const { repository } = setup();
      const template = await seedPublishedTemplate({ moderationStatus: "hidden" });

      const isEmptied = await repository.emptyRemoved(template.id, "staff");

      expect(isEmptied).toBe(false);
      expect(await findStoredTemplate(template.id)).toEqual(template);
    });
  });

  describe("keepRemovedPagesOf", () => {
    it("keeps the title of the once-public templates alone, under the time they were first removed", async () => {
      const { repository } = setup();
      const removedAt = new Date("2026-11-10T10:00:00.000Z");
      const [published, staffRemoved, neverPublic] = [
        { id: faker.string.uuid(), title: "Llama 3.1 Chat", publishedAt: PUBLISHED_AT, removedAt: null },
        { id: faker.string.uuid(), title: "Removed earlier", publishedAt: PUBLISHED_AT, removedAt },
        { id: faker.string.uuid(), title: "Never public", publishedAt: null, removedAt: null }
      ];

      await repository.keepRemovedPagesOf([published, staffRemoved, neverPublic]);

      expect(await tombstoneOf(published.id)).toEqual({ templateId: published.id, title: "Llama 3.1 Chat", removedAt: expect.any(Date) });
      expect(await tombstoneOf(staffRemoved.id)).toEqual({ templateId: staffRemoved.id, title: "Removed earlier", removedAt });
      expect(await tombstoneOf(neverPublic.id)).toBeUndefined();
    });

    it("writes nothing when no deleted template was ever public, and keeps the first page of one kept twice", async () => {
      const { repository } = setup();
      const published = { id: faker.string.uuid(), title: "First title", publishedAt: PUBLISHED_AT, removedAt: null };

      await repository.keepRemovedPagesOf([]);
      await repository.keepRemovedPagesOf([{ id: faker.string.uuid(), title: "Never public", publishedAt: null, removedAt: null }]);
      await repository.keepRemovedPagesOf([published]);
      await repository.keepRemovedPagesOf([{ ...published, title: "Second title" }]);

      expect(await tombstoneOf(published.id)).toMatchObject({ title: "First title" });
    });
  });

  describe("findRemovedTitle", () => {
    it("answers the title of a removed template that was once public", async () => {
      const { repository } = setup();
      const template = await seedPublishedTemplate({ moderationStatus: "removed", title: "Llama 3.1 Chat" });

      expect(await repository.findRemovedTitle(template.id)).toBe("Llama 3.1 Chat");
    });

    it("answers the title kept for a template whose row is gone", async () => {
      const { repository } = setup();
      const id = faker.string.uuid();
      await repository.keepRemovedPagesOf([{ id, title: "Gone with its account", publishedAt: PUBLISHED_AT, removedAt: null }]);

      expect(await repository.findRemovedTitle(id)).toBe("Gone with its account");
    });

    it("answers nothing for a removed template that was never public, a live one and an unknown id", async () => {
      const { repository } = setup();
      const [removedNeverPublic, live, hidden] = await Promise.all([
        seedTemplate({ moderationStatus: "removed" }),
        seedPublishedTemplate(),
        seedPublishedTemplate({ moderationStatus: "hidden" })
      ]);

      expect(await repository.findRemovedTitle(removedNeverPublic.id)).toBeUndefined();
      expect(await repository.findRemovedTitle(live.id)).toBeUndefined();
      expect(await repository.findRemovedTitle(hidden.id)).toBeUndefined();
      expect(await repository.findRemovedTitle(faker.string.uuid())).toBeUndefined();
    });
  });

  const VERSION_CONTENT = {
    sdl: "version: '2.0'\nservices: {}",
    readme: "# Readme",
    askedValues: [{ key: "PORT", label: "Port", type: "text" as const, required: false, bindings: [{ service: "web", env: "PORT" }] }],
    resources: { cpu: 1, memoryBytes: 1024, storageBytes: 2048 },
    imageDigests: { "nginx:1.27.2": "sha256:abc" },
    checkResults: { ranAt: "2026-11-18T10:00:00.000Z", checks: [] },
    changes: ["first_version" as const]
  };

  async function seedPublishedTemplate(overrides: Parameters<typeof seedTemplate>[0] = {}) {
    const organization = overrides.organizationId ? { id: overrides.organizationId } : await seedOrganization();

    return await seedTemplate({
      organizationId: organization.id,
      visibility: "public",
      isPublic: true,
      isListed: true,
      isOfficial: true,
      isFeatured: true,
      publishedAt: PUBLISHED_AT,
      description: "A description",
      summary: "A summary",
      icon: "rocket",
      categories: ["Tools"],
      ...overrides
    });
  }

  async function favoritesOf(templateId: string) {
    const favorites = resolveTable("TemplateFavorites");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(favorites).where(eq(favorites.templateId, templateId));
  }

  async function reportsOf(templateId: string) {
    const reports = resolveTable("TemplateReports");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(reports).where(eq(reports.templateId, templateId));
  }

  async function tombstoneOf(templateId: string) {
    const tombstones = resolveTable("TemplateTombstones");
    const [tombstone] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(tombstones).where(eq(tombstones.templateId, templateId));

    return tombstone;
  }

  function setup() {
    return { repository: container.resolve(TemplateRemovalRepository) };
  }
});
