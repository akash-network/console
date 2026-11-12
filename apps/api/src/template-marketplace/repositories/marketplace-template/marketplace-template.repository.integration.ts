import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { AuthorizationMode } from "@src/organization/types/organization-context";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateModerationStatus, TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { MarketplaceTemplateRepository } from "./marketplace-template.repository";

import { seedOrganization, seedProject } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { holdTransaction, waitForLockWait } from "@test/services/lock-wait";

describe(MarketplaceTemplateRepository.name, () => {
  describe("findReadable", () => {
    it("returns an active public template to a reader without rules, with its author and publisher", async () => {
      const { repository, organization, project, author } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, authorId: author.id, visibility: "public" });

      const found = await repository.findReadable(template.id);

      expect(found).toEqual({
        ...template,
        authorUsername: author.username,
        publisher: { name: organization.name, slug: organization.slug, type: organization.type }
      });
    });

    it("names neither author nor publisher for a template filed in no organization whose author is gone", async () => {
      const { repository } = await setup();
      const template = await seedTemplate({ visibility: "public" });

      const found = await repository.findReadable(template.id);

      expect(found).toMatchObject({ id: template.id, authorUsername: null, publisher: null });
    });

    it("keeps private and organization templates from a reader without rules", async () => {
      const { repository, organization, project } = await setup();
      const templates = await Promise.all(
        (["private", "organization"] as const).map(visibility => seedTemplate({ organizationId: organization.id, projectId: project.id, visibility }))
      );

      const found = await Promise.all(templates.map(({ id }) => repository.findReadable(id)));

      expect(found).toEqual([undefined, undefined]);
    });

    it("returns a template within the rules attached even while another organization is active", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "organization" });
      const readable = repository.accessibleBy(
        abilityOf([{ action: "read", subject: "Template", conditions: { organizationId: organization.id, visibility: "organization" } }]),
        "read"
      );

      const found = await runInOrganization(other.id, () => readable.findReadable(template.id));

      expect(found).toMatchObject({ id: template.id });
    });

    it("keeps a template outside the rules attached", async () => {
      const { repository, organization, project } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" });
      const readable = repository.accessibleBy(
        abilityOf([{ action: "read", subject: "Template", conditions: { organizationId: organization.id, visibility: "organization" } }]),
        "read"
      );

      expect(await readable.findReadable(template.id)).toBeUndefined();
    });

    it("hides a hidden public template from a reader without rules but not from one within them", async () => {
      const { repository, organization, project } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "public", moderationStatus: "hidden" });
      const readable = repository.accessibleBy(abilityOf([{ action: "read", subject: "Template", conditions: { organizationId: organization.id } }]), "read");

      const found = await Promise.all([repository.findReadable(template.id), readable.findReadable(template.id)]);

      expect(found.map(row => row?.id)).toEqual([undefined, template.id]);
    });

    it("hides a removed template even from a rule without conditions", async () => {
      const { repository, organization, project } = await setup();
      const [removed, kept] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "public", moderationStatus: "removed" }),
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" })
      ]);
      const readable = repository.accessibleBy(abilityOf([{ action: "manage", subject: "all" }]), "read");

      const found = await Promise.all([readable.findReadable(removed.id), readable.findReadable(kept.id)]);

      expect(found.map(row => row?.id)).toEqual([undefined, kept.id]);
    });
  });

  describe("findReadableIds", () => {
    it("keeps the ids of templates within the rules or active and public, dropping removed, hidden and unknown ones", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const [withinRules, outsideRules, publicElsewhere, hiddenElsewhere, removed] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "organization" }),
        seedTemplate({ organizationId: other.id, visibility: "private" }),
        seedTemplate({ organizationId: other.id, visibility: "public" }),
        seedTemplate({ organizationId: other.id, visibility: "public", moderationStatus: "hidden" }),
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private", moderationStatus: "removed" })
      ]);
      const readable = repository.accessibleBy(abilityOf([{ action: "read", subject: "Template", conditions: { organizationId: organization.id } }]), "read");

      const found = await readable.findReadableIds([withinRules.id, outsideRules.id, publicElsewhere.id, hiddenElsewhere.id, removed.id, faker.string.uuid()]);

      expect(found).toEqual(new Set([withinRules.id, publicElsewhere.id]));
    });

    it("finds nothing for no ids", async () => {
      const { repository } = await setup();

      expect(await repository.findReadableIds([])).toEqual(new Set());
    });
  });

  describe("createTemplate", () => {
    it("creates a private, listed template in the active organization's default project", async () => {
      const { repository, organization, author } = await setup();
      const defaultProject = await seedProject({ organizationId: organization.id, isDefault: true });
      const input = createTemplateInput({ authorId: author.id });

      const id = await runInOrganization(organization.id, () => repository.createTemplate(input));

      expect(await storedTemplate(id)).toMatchObject({
        ...input,
        organizationId: organization.id,
        projectId: defaultProject.id,
        visibility: "private",
        isPublic: false,
        isListed: true,
        copiedFromId: null,
        currentVersionId: null
      });
    });

    it("files the template in the project it names and records the template it was copied from", async () => {
      const { repository, organization, project, author } = await setup();
      const original = await seedTemplate({ visibility: "public" });
      const input = createTemplateInput({ authorId: author.id, projectId: project.id, copiedFromId: original.id });

      const id = await runInOrganization(organization.id, () => repository.createTemplate(input));

      expect(await storedTemplate(id)).toMatchObject({ organizationId: organization.id, projectId: project.id, copiedFromId: original.id });
    });
  });

  describe("mirrorVersion", () => {
    it("writes a version's content to the legacy columns of that template alone, whichever organization is active", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const [template, untouched] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" }),
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" })
      ]);
      const mirror = { sdl: "version: '2.1'", description: "# Readme", cpu: 1500, ram: 2048, storage: 4096 };

      await runInOrganization(other.id, () => repository.mirrorVersion(template.id, mirror));

      expect(await storedTemplate(template.id)).toMatchObject({ ...mirror, title: template.title, visibility: "private", isPublic: false });
      expect(await storedTemplate(untouched.id)).toEqual(untouched);
    });
  });

  describe("listInOrganization", () => {
    it("lists the organization's templates within the rules, newest update first, with the current version and its creator", async () => {
      const { repository, organization, project, author } = await setup();
      const other = await seedOrganization();
      const older = await seedTemplate({
        organizationId: organization.id,
        projectId: project.id,
        visibility: "private",
        updatedAt: new Date("2026-11-01T00:00:00Z")
      });
      const newer = await seedTemplate({
        organizationId: organization.id,
        projectId: project.id,
        visibility: "organization",
        updatedAt: new Date("2026-11-02T00:00:00Z")
      });
      const version = await container.resolve(TemplateVersionRepository).appendVersion({ templateId: newer.id, sdl: "version: '2.0'", createdById: author.id });
      await setUpdatedAt(newer.id, new Date("2026-11-02T00:00:00Z"));
      await Promise.all([
        seedTemplate({ organizationId: other.id, visibility: "organization" }),
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "organization", moderationStatus: "removed" }),
        seedTemplate({ visibility: "public" })
      ]);
      const readable = repository.accessibleBy(abilityOf([{ action: "read", subject: "Template" }]), "read");

      const listed = await runInOrganization(organization.id, () => readable.listInOrganization({ organizationId: organization.id, limit: 200 }));

      expect(listed).toEqual([
        {
          id: newer.id,
          userId: null,
          organizationId: organization.id,
          projectId: project.id,
          copiedFromId: null,
          title: newer.title,
          summary: null,
          icon: null,
          categories: [],
          visibility: "organization",
          isListed: true,
          moderationStatus: "active",
          updatedAt: new Date("2026-11-02T00:00:00Z"),
          currentVersion: { version: 1, status: "live", createdAt: version.createdAt },
          lastEditedByUsername: author.username
        },
        expect.objectContaining({ id: older.id, currentVersion: null, lastEditedByUsername: null })
      ]);
    });

    it("keeps templates outside the rules attached", async () => {
      const { repository, organization, project } = await setup();
      const [organizationWide] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "organization" }),
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" })
      ]);
      const readable = repository.accessibleBy(
        abilityOf([{ action: "read", subject: "Template", conditions: { organizationId: organization.id, visibility: "organization" } }]),
        "read"
      );

      const listed = await runInOrganization(organization.id, () => readable.listInOrganization({ organizationId: organization.id, limit: 200 }));

      expect(listed.map(({ id }) => id)).toEqual([organizationWide.id]);
    });

    it("narrows to the visibility and project asked for, up to the limit", async () => {
      const { repository, organization, project } = await setup();
      const otherProject = await seedProject({ organizationId: organization.id });
      const [newest, older] = [
        await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "organization", updatedAt: new Date("2026-11-03T00:00:00Z") }),
        await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "organization", updatedAt: new Date("2026-11-02T00:00:00Z") })
      ];
      await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" }),
        seedTemplate({ organizationId: organization.id, projectId: otherProject.id, visibility: "organization" })
      ]);
      const readable = repository.accessibleBy(abilityOf([{ action: "read", subject: "Template" }]), "read");
      const filter = { organizationId: organization.id, visibility: "organization" as const, projectId: project.id };

      const [all, limited] = await runInOrganization(organization.id, () =>
        Promise.all([readable.listInOrganization({ ...filter, limit: 200 }), readable.listInOrganization({ ...filter, limit: 1 })])
      );

      expect(all.map(({ id }) => id)).toEqual([newest.id, older.id]);
      expect(limited.map(({ id }) => id)).toEqual([newest.id]);
    });

    it("holds to the organization asked for in legacy mode, whatever the rules reach", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const [own] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" }),
        seedTemplate({ organizationId: other.id, visibility: "private" }),
        seedTemplate({ visibility: "private" })
      ]);
      const readable = repository.accessibleBy(abilityOf([{ action: "manage", subject: "all" }]), "read");

      const listed = await runInOrganization(organization.id, () => readable.listInOrganization({ organizationId: organization.id, limit: 200 }), "legacy");

      expect(listed.map(({ id }) => id)).toEqual([own.id]);
    });
  });

  describe("updateSettings", () => {
    it("writes the settings of that template alone, whichever organization is active", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const [template, untouched] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "public" }),
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "public" })
      ]);
      const settings = {
        title: "Renamed",
        summary: "Serves the web",
        icon: "rocket",
        categories: ["Tools"],
        visibility: "organization" as const,
        isPublic: false
      };

      await runInOrganization(other.id, () => repository.updateSettings(template.id, settings));

      expect(await storedTemplate(template.id)).toMatchObject({ ...settings, organizationId: organization.id, isListed: true, sdl: template.sdl });
      expect(await storedTemplate(untouched.id)).toEqual(untouched);
    });
  });

  describe("deleteTemplate", () => {
    it("deletes that template alone with its versions and favorites, whichever organization is active", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const [template, untouched] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" }),
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" })
      ]);
      await container.resolve(TemplateVersionRepository).appendVersion({ templateId: template.id, sdl: "version: '2.0'" });
      await seedFavorite(template.id);

      await runInOrganization(other.id, () => repository.deleteTemplate(template.id));

      expect(await storedTemplate(template.id)).toBeUndefined();
      expect(await rowsOf("TemplateVersions", template.id)).toEqual([]);
      expect(await rowsOf("TemplateFavorites", template.id)).toEqual([]);
      expect(await storedTemplate(untouched.id)).toEqual(untouched);
    });
  });

  describe("findAndLockForWrite", () => {
    it("returns the template row inside a transaction, whichever organization is active", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" });

      const [found, missing] = await runInOrganization(other.id, () =>
        container
          .resolve(TxService)
          .transaction(async () => [await repository.findAndLockForWrite(template.id), await repository.findAndLockForWrite(faker.string.uuid())])
      );

      expect(found).toEqual(template);
      expect(missing).toBeUndefined();
    });

    it("holds the row until the transaction ends, so a concurrent change waits for it", async () => {
      const { repository, organization, project } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" });
      const events: string[] = [];
      const holder = holdTransaction(async () => {
        await repository.findAndLockForWrite(template.id);
      });
      await holder.held;

      const competitor = container.resolve(TxService).transaction(async () => {
        await repository.findAndLockForWrite(template.id);
        events.push("competitor locked");
      });
      await waitForLockWait("%for no key update%");
      events.push("released");
      holder.release();
      await Promise.all([holder.committed, competitor]);

      expect(events).toEqual(["released", "competitor locked"]);
    });
  });

  async function seedTemplate(input: {
    organizationId?: string;
    projectId?: string;
    authorId?: string;
    visibility: TemplateVisibility;
    moderationStatus?: TemplateModerationStatus;
    updatedAt?: Date;
  }) {
    const { updatedAt, ...values } = input;
    const [template] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({ ...values, isPublic: input.visibility === "public", title: faker.lorem.words(3), sdl: "version: '2.0'", cpu: 1000, ram: 1024, storage: 1024 })
      .returning();

    if (!updatedAt) return template;

    await setUpdatedAt(template.id, updatedAt);

    return await storedTemplate(template.id);
  }

  async function setUpdatedAt(id: string, updatedAt: Date) {
    const templates = resolveTable("Templates");
    await container.resolve<ApiPgDatabase>(POSTGRES_DB).update(templates).set({ updatedAt }).where(eq(templates.id, id));
  }

  async function seedFavorite(templateId: string) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("TemplateFavorites"))
      .values({ userId: `auth0|${faker.string.alphanumeric(24)}`, templateId, addedDate: new Date() });
  }

  async function rowsOf(tableName: "TemplateVersions" | "TemplateFavorites", templateId: string) {
    const table = resolveTable(tableName);

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(table).where(eq(table.templateId, templateId));
  }

  function createTemplateInput(overrides: { authorId: string; projectId?: string; copiedFromId?: string }) {
    return {
      title: faker.lorem.words(3),
      summary: faker.lorem.sentence(),
      userId: `auth0|${faker.string.alphanumeric(24)}`,
      sdl: "version: '2.0'",
      description: "# Readme",
      cpu: 500,
      ram: 1024,
      storage: 2048,
      ...overrides
    };
  }

  async function storedTemplate(id: string) {
    const templates = resolveTable("Templates");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(templates).where(eq(templates.id, id));

    return row;
  }

  function abilityOf(rules: RawRuleOf<MongoAbility>[]) {
    return createMongoAbility<MongoAbility>(rules);
  }

  async function runInOrganization<R>(organizationId: string, run: () => Promise<R>, mode: AuthorizationMode = "organization") {
    const executionContextService = container.resolve(ExecutionContextService);

    return await executionContextService.runWithContext(async () => {
      executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId, mode }));
      return await run();
    });
  }

  async function setup() {
    const organization = await seedOrganization();
    const project = await seedProject({ organizationId: organization.id });
    const author = await container.resolve(UserRepository).create({ username: `author_${faker.string.alphanumeric(12)}` });
    const repository = container.resolve(MarketplaceTemplateRepository);

    return { repository, organization, project, author };
  }
});
