import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services";
import { type ImportedTemplateContent } from "@src/template-marketplace/lib/imported-template/imported-template";
import { ImportedTemplateRepository, type NewImportedTemplate } from "./imported-template.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { findStoredTemplate, seedTemplate, seedTemplateModerationEvent } from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(ImportedTemplateRepository.name, () => {
  describe("findOwningOrganization", () => {
    it("finds the organization with what its publisher handle is made from", async () => {
      const { repository } = setup();
      const owner = await seedUser();
      const organization = await seedOrganization({ name: "Akash", type: "team", createdByUserId: owner.id });

      expect(await repository.findOwningOrganization(organization.id)).toEqual({
        name: "Akash",
        slug: organization.slug,
        type: "team",
        ownerUsername: owner.username
      });
    });

    it("finds an organization whose creator is gone, and none for a deleted organization or an unknown id", async () => {
      const { repository } = setup();
      const [ownerless, deleted] = await Promise.all([seedOrganization(), seedOrganization({ deletedAt: new Date() })]);

      expect(await repository.findOwningOrganization(ownerless.id)).toMatchObject({ slug: ownerless.slug, ownerUsername: null });
      expect(await repository.findOwningOrganization(deleted.id)).toBeUndefined();
      expect(await repository.findOwningOrganization(faker.string.uuid())).toBeUndefined();
    });
  });

  describe("create", () => {
    it("creates a public, listed, Official template published now, with no author and no project", async () => {
      const { repository } = setup();
      const organization = await seedOrganization();
      const template = newImportedTemplate({ organizationId: organization.id });
      const before = Date.now();

      const id = await repository.create(template);

      const stored = await findStoredTemplate(id!);
      expect(stored).toMatchObject({
        ...template,
        visibility: "public",
        isPublic: true,
        isListed: true,
        isOfficial: true,
        isFeatured: false,
        moderationStatus: "active",
        userId: null,
        authorId: null,
        projectId: null,
        copiedFromId: null,
        currentVersionId: null
      });
      expect(stored.publishedAt!.getTime()).toBeGreaterThanOrEqual(before - 5_000);
    });

    it("creates one template per gallery id however many runs create it at once, and answers nothing to the others", async () => {
      const { repository } = setup();
      const organization = await seedOrganization();
      const template = newImportedTemplate({ organizationId: organization.id });

      const ids = await Promise.all([repository.create(template), repository.create(template), repository.create(template)]);
      const later = await repository.create({ ...template, title: "Written by a later run" });

      const created = ids.filter(Boolean);
      expect(created).toHaveLength(1);
      expect(later).toBeUndefined();
      expect((await repository.listAll()).filter(stored => stored.importedRef === template.importedRef)).toMatchObject([
        { id: created[0], title: template.title }
      ]);
    });
  });

  describe("listAll", () => {
    it("lists every imported template with what the next run compares, and no template the import does not own", async () => {
      const { repository } = setup();
      const importedRef = newImportedRef();
      const [imported, hidden, own] = await Promise.all([
        seedTemplate({
          importedRef,
          importedContentHash: "a".repeat(64),
          title: "ComfyUI",
          summary: "Node based UI",
          categories: ["AI - GPU"],
          visibility: "public"
        }),
        seedTemplate({ importedRef: newImportedRef(), moderationStatus: "hidden", isListed: false }),
        seedTemplate({ visibility: "public" })
      ]);

      const listed = await repository.listAll();

      expect(listed.find(stored => stored.id === imported.id)).toEqual({
        id: imported.id,
        importedRef,
        title: "ComfyUI",
        summary: "Node based UI",
        categories: ["AI - GPU"],
        isListed: true,
        moderationStatus: "active",
        importedContentHash: "a".repeat(64),
        hasStaffCategories: false
      });
      expect(listed.find(stored => stored.id === hidden.id)).toMatchObject({ moderationStatus: "hidden", isListed: false, importedContentHash: null });
      expect(listed.map(stored => stored.id)).not.toContain(own.id);
    });

    it("tells which templates staff chose the categories of, from the moderation log", async () => {
      const { repository } = setup();
      const [edited, featured, untouched] = await Promise.all([
        seedTemplate({ importedRef: newImportedRef() }),
        seedTemplate({ importedRef: newImportedRef() }),
        seedTemplate({ importedRef: newImportedRef() })
      ]);
      await Promise.all([
        seedTemplateModerationEvent({ templateId: edited.id, action: "edit_categories" }),
        seedTemplateModerationEvent({ templateId: edited.id, action: "feature" }),
        seedTemplateModerationEvent({ templateId: featured.id, action: "feature" })
      ]);

      const listed = new Map((await repository.listAll()).map(stored => [stored.id, stored.hasStaffCategories]));

      expect([edited, featured, untouched].map(template => listed.get(template.id))).toEqual([true, false, false]);
    });
  });

  describe("findAndLock", () => {
    it("reads the imported template as it is now, and nothing for a template the import does not own or an unknown id", async () => {
      const { repository, txService } = setup();
      const importedRef = newImportedRef();
      const [imported, own] = await Promise.all([seedTemplate({ importedRef, title: "ComfyUI" }), seedTemplate()]);
      await seedTemplateModerationEvent({ templateId: imported.id, action: "edit_categories" });

      const locked = await txService.transaction(async () => [
        await repository.findAndLock(imported.id),
        await repository.findAndLock(own.id),
        await repository.findAndLock(faker.string.uuid())
      ]);

      expect(locked).toEqual([expect.objectContaining({ id: imported.id, importedRef, title: "ComfyUI", hasStaffCategories: true }), undefined, undefined]);
    });
  });

  describe("update", () => {
    it("writes the given fields on the one template and leaves the rest as they were", async () => {
      const { repository } = setup();
      const [imported, other] = await Promise.all([
        seedTemplate({ importedRef: newImportedRef(), title: "Old", summary: "Kept", isListed: false }),
        seedTemplate({ importedRef: newImportedRef(), title: "Other" })
      ]);

      await repository.update(imported.id, { title: "New", isListed: true, importedContentHash: "b".repeat(64) });

      expect(await findStoredTemplate(imported.id)).toMatchObject({ title: "New", summary: "Kept", isListed: true, importedContentHash: "b".repeat(64) });
      expect(await findStoredTemplate(other.id)).toMatchObject({ title: "Other", importedContentHash: null });
    });
  });

  describe("unlist", () => {
    it("takes the listed imported templates out of the listings, and leaves alone what staff moderated and what the import does not own", async () => {
      const { repository } = setup();
      const [listed, alreadyUnlisted, hidden, removed, own, untouched] = await Promise.all([
        seedTemplate({ importedRef: newImportedRef(), visibility: "public" }),
        seedTemplate({ importedRef: newImportedRef(), isListed: false }),
        seedTemplate({ importedRef: newImportedRef(), moderationStatus: "hidden" }),
        seedTemplate({ importedRef: newImportedRef(), moderationStatus: "removed" }),
        seedTemplate({ visibility: "public" }),
        seedTemplate({ importedRef: newImportedRef() })
      ]);

      const unlisted = await repository.unlist([listed.id, alreadyUnlisted.id, hidden.id, removed.id, own.id]);

      const stored = await Promise.all([listed, alreadyUnlisted, hidden, removed, own, untouched].map(template => findStoredTemplate(template.id)));
      expect(unlisted).toBe(1);
      expect(stored.map(template => template.isListed)).toEqual([false, false, true, true, true, true]);
      expect(stored[0]).toMatchObject({ visibility: "public", moderationStatus: "active" });
    });

    it("unlists more templates than one statement takes, and none when given none", async () => {
      const { repository } = setup();
      const templates = await Promise.all(Array.from({ length: 4 }, () => seedTemplate({ importedRef: newImportedRef() })));
      const ids = [...templates.map(template => template.id), ...Array.from({ length: 500 }, () => faker.string.uuid())].reverse();

      expect(await repository.unlist([])).toBe(0);
      expect(await repository.unlist(ids)).toBe(4);
      expect((await Promise.all(templates.map(template => findStoredTemplate(template.id)))).map(template => template.isListed)).toEqual([
        false,
        false,
        false,
        false
      ]);
    });
  });

  function newImportedRef() {
    return `akash-network-awesome-akash-${faker.string.alphanumeric(16)}`;
  }

  function newImportedTemplate(overrides: Partial<NewImportedTemplate> & Pick<NewImportedTemplate, "organizationId">): NewImportedTemplate {
    const content: Pick<ImportedTemplateContent, "title" | "summary" | "categories"> = { title: "ComfyUI", summary: "Node based UI", categories: ["AI - GPU"] };

    return {
      ...content,
      importedRef: newImportedRef(),
      importedContentHash: "c".repeat(64),
      icon: "box",
      sdl: "version: '2.0'",
      description: "# ComfyUI",
      cpu: 500,
      ram: 1024,
      storage: 2048,
      ...overrides
    };
  }

  function setup() {
    return { repository: container.resolve(ImportedTemplateRepository), txService: container.resolve(TxService) };
  }
});
