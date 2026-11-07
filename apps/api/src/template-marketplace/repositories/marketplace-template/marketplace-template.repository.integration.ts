import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { TemplateModerationStatus, TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { MarketplaceTemplateRepository } from "./marketplace-template.repository";

import { seedOrganization, seedProject } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

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

  async function seedTemplate(input: {
    organizationId?: string;
    projectId?: string;
    authorId?: string;
    visibility: TemplateVisibility;
    moderationStatus?: TemplateModerationStatus;
  }) {
    const [template] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({ ...input, isPublic: input.visibility === "public", title: faker.lorem.words(3), sdl: "version: '2.0'", cpu: 1000, ram: 1024, storage: 1024 })
      .returning();

    return template;
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
