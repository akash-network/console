import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TemplateVersionRepository } from "./template-version.repository";

import { seedOrganization, seedProject } from "@test/seeders/db/organization.seeder";

describe(TemplateVersionRepository.name, () => {
  const createdTemplateIds: string[] = [];

  afterEach(async () => {
    const templates = resolveTable("Templates");
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

    for (const id of createdTemplateIds) {
      await db.delete(templates).where(eq(templates.id, id));
    }
    createdTemplateIds.length = 0;
  });

  describe("appendVersion", () => {
    it("numbers versions from 1 and points the template at the newest", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const first = await repository.appendVersion({ templateId: template.id, sdl: "version: '2.0'" });
      const second = await repository.appendVersion({ templateId: template.id, sdl: "version: '2.1'" });

      expect([first.version, second.version]).toEqual([1, 2]);
      expect(await repository.findCurrent(template.id)).toEqual(second);
      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: second.id });
    });

    it("stores what the version was given and defaults the rest", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const resources = { cpu: 2, memoryBytes: 1024, storageBytes: 2048 };

      const version = await repository.appendVersion({ templateId: template.id, sdl: "sdl", readme: "# readme", askedValues: [{ key: "PORT" }], resources });
      const bare = await repository.appendVersion({ templateId: template.id, sdl: "other" });

      expect(version).toEqual({
        id: expect.any(String),
        templateId: template.id,
        version: 1,
        sdl: "sdl",
        readme: "# readme",
        askedValues: [{ key: "PORT" }],
        resources,
        imageDigests: {},
        status: "live",
        createdById: null,
        createdAt: expect.any(Date)
      });
      expect(bare).toMatchObject({ readme: null, askedValues: [], resources: null });
    });

    it("numbers concurrent appends without a gap or a duplicate", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const versions = await Promise.all(Array.from({ length: 5 }, (_, index) => repository.appendVersion({ templateId: template.id, sdl: `sdl-${index}` })));

      expect(versions.map(({ version }) => version).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
      const current = await repository.findCurrent(template.id);
      expect(current?.version).toBe(5);
    });

    it("numbers each template's versions on their own", async () => {
      const { repository } = setup();
      const [first, second] = await Promise.all([seedTemplate(), seedTemplate()]);

      await repository.appendVersion({ templateId: first.id, sdl: "a" });
      const version = await repository.appendVersion({ templateId: second.id, sdl: "b" });

      expect(version.version).toBe(1);
    });
  });

  describe("findByTemplateAndVersion", () => {
    it("returns the version asked for and nothing for a version that does not exist", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: "a" });
      await repository.appendVersion({ templateId: template.id, sdl: "b" });

      expect(await repository.findByTemplateAndVersion(template.id, 1)).toEqual(first);
      expect(await repository.findByTemplateAndVersion(template.id, 3)).toBeUndefined();
    });
  });

  describe("findCurrent", () => {
    it("returns nothing for a template without versions", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      expect(await repository.findCurrent(template.id)).toBeUndefined();
    });
  });

  describe("listByTemplate", () => {
    it("lists versions newest first without their sdl", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: "a", readme: "r1" });
      const second = await repository.appendVersion({ templateId: template.id, sdl: "b", readme: "r2" });

      const versions = await repository.listByTemplate(template.id);

      expect(versions).toEqual([
        { id: second.id, templateId: template.id, version: 2, resources: null, status: "live", createdById: null, createdAt: second.createdAt },
        { id: first.id, templateId: template.id, version: 1, resources: null, status: "live", createdById: null, createdAt: first.createdAt }
      ]);
    });
  });

  async function seedTemplate() {
    const organization = await seedOrganization();
    const project = await seedProject({ organizationId: organization.id, isDefault: true });
    const [template] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({
        organizationId: organization.id,
        projectId: project.id,
        title: faker.lorem.words(3),
        sdl: faker.lorem.paragraph(),
        cpu: 1000,
        ram: 1000000,
        storage: 1000000
      })
      .returning();
    createdTemplateIds.push(template.id);
    return template;
  }

  async function findStoredTemplate(id: string) {
    const templates = resolveTable("Templates");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).query.Templates.findFirst({ where: eq(templates.id, id) });
  }

  function setup() {
    return { repository: container.resolve(TemplateVersionRepository) };
  }
});
