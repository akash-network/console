import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateModerationStatus, TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { MarketplaceTemplateRepository } from "./marketplace-template.repository";

import { seedOrganization, seedProject } from "@test/seeders/db/organization.seeder";
import { seedTemplatePublisher } from "@test/seeders/db/template.seeder";
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
        publisher: { name: organization.name, slug: organization.slug, type: organization.type, handle: null }
      });
    });

    it("names the publisher handle once the organization has published", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .insert(resolveTable("TemplatePublishers"))
        .values([
          { organizationId: organization.id, handle: `acme-${faker.string.alphanumeric(8).toLowerCase()}` },
          { organizationId: other.id, handle: `other-${faker.string.alphanumeric(8).toLowerCase()}` }
        ]);
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "public" });

      const found = await repository.findReadable(template.id);

      expect(found?.publisher?.handle).toMatch(/^acme-/);
    });

    it("names no author for a template whose author is gone, still naming its publisher", async () => {
      const { repository, organization, project } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "public" });

      const found = await repository.findReadable(template.id);

      expect(found).toMatchObject({
        id: template.id,
        authorUsername: null,
        publisher: { name: organization.name, slug: organization.slug, type: organization.type }
      });
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

    it("hides a suspended publisher's public templates from a reader without rules but not from one within them, until it is reinstated", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const [template, ofAnotherPublisher] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "public" }),
        seedTemplate({ organizationId: other.id, visibility: "public" })
      ]);
      await Promise.all([
        seedTemplatePublisher({ organizationId: organization.id, publishingSuspendedAt: new Date(), publishingSuspendedReason: "Spam" }),
        seedTemplatePublisher({ organizationId: other.id })
      ]);
      const readable = repository.accessibleBy(abilityOf([{ action: "read", subject: "Template", conditions: { organizationId: organization.id } }]), "read");

      const found = await Promise.all([
        repository.findReadable(template.id),
        readable.findReadable(template.id),
        repository.findReadable(ofAnotherPublisher.id)
      ]);
      await reinstatePublisher(organization.id);
      const foundOnceReinstated = await repository.findReadable(template.id);

      expect(found.map(row => row?.id)).toEqual([undefined, template.id, ofAnotherPublisher.id]);
      expect(foundOnceReinstated?.id).toBe(template.id);
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

    it("drops the public templates of a suspended publisher for a reader outside its organization", async () => {
      const { repository } = await setup();
      const [suspended, inGoodStanding] = await Promise.all([seedOrganization(), seedOrganization()]);
      const [hiddenBySuspension, shown] = await Promise.all([
        seedTemplate({ organizationId: suspended.id, visibility: "public" }),
        seedTemplate({ organizationId: inGoodStanding.id, visibility: "public" })
      ]);
      await seedTemplatePublisher({ organizationId: suspended.id, publishingSuspendedAt: new Date() });

      expect(await repository.findReadableIds([hiddenBySuspension.id, shown.id])).toEqual(new Set([shown.id]));
    });

    it("finds nothing for no ids", async () => {
      const { repository } = await setup();

      expect(await repository.findReadableIds([])).toEqual(new Set());
    });
  });

  describe("findPubliclyReadable", () => {
    it("answers the organization and current version of an active public template, whatever the caller's rules", async () => {
      const { repository, organization, project } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "public" });
      const version = await container.resolve(TemplateVersionRepository).appendVersion({ templateId: template.id, sdl: "version: '2.0'" });
      const readable = repository.accessibleBy(abilityOf([{ action: "manage", subject: "all" }]), "read");

      const found = await Promise.all([repository.findPubliclyReadable(template.id), readable.findPubliclyReadable(template.id)]);

      expect(found).toEqual([
        { id: template.id, organizationId: organization.id, currentVersionId: version.id },
        { id: template.id, organizationId: organization.id, currentVersionId: version.id }
      ]);
    });

    it("answers nothing for a private, organization, hidden or removed template, one of a suspended publisher and an unknown id", async () => {
      const { repository, organization, project } = await setup();
      const suspended = await seedOrganization();
      await seedTemplatePublisher({ organizationId: suspended.id, publishingSuspendedAt: new Date() });
      const filed = { organizationId: organization.id, projectId: project.id };
      const templates = await Promise.all([
        seedTemplate({ ...filed, visibility: "private" }),
        seedTemplate({ ...filed, visibility: "organization" }),
        seedTemplate({ ...filed, visibility: "public", moderationStatus: "hidden" }),
        seedTemplate({ ...filed, visibility: "public", moderationStatus: "removed" }),
        seedTemplate({ organizationId: suspended.id, visibility: "public" })
      ]);
      const readable = repository.accessibleBy(abilityOf([{ action: "manage", subject: "all" }]), "read");

      const found = await Promise.all([
        ...templates.map(template => readable.findPubliclyReadable(template.id)),
        readable.findPubliclyReadable(faker.string.uuid())
      ]);

      expect(found).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
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
        publishedAt: new Date("2026-10-30T00:00:00Z"),
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
          publishedAt: new Date("2026-10-30T00:00:00Z"),
          updatedAt: new Date("2026-11-02T00:00:00Z"),
          currentVersion: { version: 1, status: "live", createdAt: version.createdAt },
          lastEditedByUsername: author.username
        },
        expect.objectContaining({ id: older.id, publishedAt: null, currentVersion: null, lastEditedByUsername: null })
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

    it("holds to the organization asked for outside an organization context, whatever the rules reach", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const [own] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" }),
        seedTemplate({ organizationId: other.id, visibility: "private" }),
        seedTemplate({ visibility: "private" })
      ]);
      const readable = repository.accessibleBy(abilityOf([{ action: "manage", subject: "all" }]), "read");

      const listed = await readable.listInOrganization({ organizationId: organization.id, limit: 200 });

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

  describe("markPublished", () => {
    it("makes that template alone public and listed and stamps when it first went public", async () => {
      const { repository, organization, project } = await setup();
      const [template, untouched] = await Promise.all([
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" }),
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" })
      ]);
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .update(resolveTable("Templates"))
        .set({ isListed: false })
        .where(eq(resolveTable("Templates").id, template.id));

      await repository.markPublished(template.id);

      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "public", isPublic: true, isListed: true, publishedAt: expect.any(Date) });
      expect(await storedTemplate(untouched.id)).toMatchObject({ visibility: "private", isPublic: false, publishedAt: null });
    });

    it("keeps the first publication time when a template is published again", async () => {
      const { repository, organization, project } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" });
      const firstPublishedAt = new Date("2026-10-01T00:00:00.000Z");
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .update(resolveTable("Templates"))
        .set({ publishedAt: firstPublishedAt })
        .where(eq(resolveTable("Templates").id, template.id));

      await repository.markPublished(template.id);

      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "public", publishedAt: firstPublishedAt });
    });

    it("keeps the publication time when the settings move the template out of public", async () => {
      const { repository, organization, project } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private" });
      await repository.markPublished(template.id);
      const { publishedAt } = await storedTemplate(template.id);

      await repository.updateSettings(template.id, { visibility: "private", isPublic: false });

      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "private", isPublic: false, publishedAt });
      expect(publishedAt).toBeInstanceOf(Date);
    });
  });

  describe("findOfAnyOrganization", () => {
    it("reads a private, hidden or removed template of any organization, with no organization in context", async () => {
      const { repository, organization, project } = await setup();
      const other = await seedOrganization();
      const templates = await Promise.all([
        seedTemplate({ organizationId: other.id, visibility: "private" }),
        seedTemplate({ organizationId: other.id, visibility: "public", moderationStatus: "hidden" }),
        seedTemplate({ organizationId: organization.id, projectId: project.id, visibility: "private", moderationStatus: "removed" })
      ]);

      const found = await Promise.all(templates.map(template => repository.findOfAnyOrganization(template.id)));

      expect(found.map(template => [template?.id, template?.title, template?.organizationId])).toEqual([
        [templates[0].id, templates[0].title, other.id],
        [templates[1].id, templates[1].title, other.id],
        [templates[2].id, templates[2].title, organization.id]
      ]);
    });

    it("finds nothing for an id no template has", async () => {
      const { repository } = await setup();

      expect(await repository.findOfAnyOrganization(faker.string.uuid())).toBeUndefined();
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
    publishedAt?: Date;
    updatedAt?: Date;
  }) {
    const { updatedAt, ...values } = input;
    const [template] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({
        ...values,
        organizationId: values.organizationId ?? (await seedOrganization()).id,
        isPublic: input.visibility === "public",
        title: faker.lorem.words(3),
        sdl: "version: '2.0'",
        cpu: 1000,
        ram: 1024,
        storage: 1024
      })
      .returning();

    if (!updatedAt) return template;

    await setUpdatedAt(template.id, updatedAt);

    return await storedTemplate(template.id);
  }

  async function reinstatePublisher(organizationId: string) {
    const publishers = resolveTable("TemplatePublishers");
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .update(publishers)
      .set({ publishingSuspendedAt: null, publishingSuspendedReason: null })
      .where(eq(publishers.organizationId, organizationId));
  }

  async function setUpdatedAt(id: string, updatedAt: Date) {
    const templates = resolveTable("Templates");
    await container.resolve<ApiPgDatabase>(POSTGRES_DB).update(templates).set({ updatedAt }).where(eq(templates.id, id));
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

  async function runInOrganization<R>(organizationId: string, run: () => Promise<R>) {
    const executionContextService = container.resolve(ExecutionContextService);

    return await executionContextService.runWithContext(async () => {
      executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId }));
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
