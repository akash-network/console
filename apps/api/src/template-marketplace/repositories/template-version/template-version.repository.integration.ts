import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { TemplateVersionRepository } from "./template-version.repository";

import { seedOrganization, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

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
      const portValue: AskedValue = { type: "number", key: "PORT", label: "Port", required: true, bindings: [{ service: "web", env: "PORT" }] };

      const version = await repository.appendVersion({ templateId: template.id, sdl: "sdl", readme: "# readme", askedValues: [portValue], resources });
      const bare = await repository.appendVersion({ templateId: template.id, sdl: "other" });

      expect(version).toEqual({
        id: expect.any(String),
        templateId: template.id,
        version: 1,
        sdl: "sdl",
        readme: "# readme",
        askedValues: [portValue],
        resources,
        imageDigests: {},
        status: "live",
        changes: ["first_version"],
        createdById: null,
        createdBy: null,
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

    it("stores the changes from the current version under the lock", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const first = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1") });
      const second = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("caddy:1") });
      const third = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("caddy:1"), readme: "# New" });

      expect([first.changes, second.changes, third.changes]).toEqual([["first_version"], ["image_changed"], ["readme_changed"]]);
      expect((await repository.listByTemplate(template.id)).map(({ changes }) => changes)).toEqual([["readme_changed"], ["image_changed"], ["first_version"]]);
    });

    it("reads an asked value sent in another key order than jsonb stores it as unchanged", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const asked: AskedValue = { key: "PORT", label: "Port", required: true, bindings: [{ service: "web", env: "PORT" }], type: "number" };
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1"), askedValues: [asked] });

      const resaved = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1"), askedValues: [asked] });

      expect(resaved.changes).toEqual([]);
    });

    it("compares each concurrent append with the version it numbers after", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("app:0") });

      const versions = await Promise.all(
        Array.from({ length: 4 }, (_, index) => repository.appendVersion({ templateId: template.id, sdl: sdlWithImage(`app:${index + 1}`) }))
      );

      expect(versions.map(({ changes }) => changes)).toEqual(Array.from({ length: 4 }, () => ["image_tag_changed"]));
    });

    it("accepts an append whose expected current version is the current one", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1") });

      const second = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:2"), expectedCurrentVersionId: first.id });

      expect(second.version).toBe(2);
    });

    it("refuses an append whose expected current version is stale and records nothing", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1") });
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:2") });

      const refused = repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:3"), expectedCurrentVersionId: first.id });

      await expect(refused).rejects.toMatchObject({ status: 409, message: "The template has a newer version", errorCode: "template_version_conflict" });
      expect(await repository.listByTemplate(template.id)).toHaveLength(2);
      expect((await repository.findCurrent(template.id))?.version).toBe(2);
    });

    it("lets exactly one of two appends from the same expected version through", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1") });

      const results = await Promise.allSettled(
        ["nginx:2", "nginx:3"].map(image => repository.appendVersion({ templateId: template.id, sdl: sdlWithImage(image), expectedCurrentVersionId: first.id }))
      );

      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({ status: 409, errorCode: "template_version_conflict" });
      expect(await repository.listByTemplate(template.id)).toHaveLength(2);
    });

    it("refuses an append expecting a current version on a template that has none", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const refused = repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1"), expectedCurrentVersionId: faker.string.uuid() });

      await expect(refused).rejects.toMatchObject({ status: 409, errorCode: "template_version_conflict" });
      expect(await repository.listByTemplate(template.id)).toEqual([]);
    });

    it("names the creator by username", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const creator = await seedUser({ username: faker.internet.userName() });

      const appended = await repository.appendVersion({ templateId: template.id, sdl: "a", createdById: creator.id });

      expect(appended.createdBy).toEqual({ username: creator.username });
      expect((await repository.findCurrent(template.id))?.createdBy).toEqual({ username: creator.username });
      expect((await repository.findById(appended.id))?.createdBy).toEqual({ username: creator.username });
      expect((await repository.findByTemplateAndVersion(template.id, 1))?.createdBy).toEqual({ username: creator.username });
      expect((await repository.listByTemplate(template.id))[0].createdBy).toEqual({ username: creator.username });
    });

    it("names no creator for a creator without a username", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const creator = await seedUser({ username: null });

      const appended = await repository.appendVersion({ templateId: template.id, sdl: "a", createdById: creator.id });

      expect(appended.createdBy).toBeNull();
      expect((await repository.findCurrent(template.id))?.createdBy).toBeNull();
    });

    it("numbers each template's versions on their own", async () => {
      const { repository } = setup();
      const [first, second] = await Promise.all([seedTemplate(), seedTemplate()]);

      await repository.appendVersion({ templateId: first.id, sdl: "a" });
      const version = await repository.appendVersion({ templateId: second.id, sdl: "b" });

      expect(version.version).toBe(1);
    });
  });

  describe("immutability", () => {
    it("refuses to change a saved version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const saved = await repository.appendVersion({ templateId: template.id, sdl: "a" });

      await expect(repository.updateById()).rejects.toThrow("Template versions are immutable");
      await expect(repository.updateBy()).rejects.toThrow("Template versions are immutable");
      await expect(repository.updateManyById()).rejects.toThrow("Template versions are immutable");
      expect(await repository.findByTemplateAndVersion(template.id, 1)).toEqual(saved);
    });

    it("refuses to delete a saved version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const saved = await repository.appendVersion({ templateId: template.id, sdl: "a" });

      await expect(repository.deleteById()).rejects.toThrow("Template versions are immutable");
      await expect(repository.deleteBy()).rejects.toThrow("Template versions are immutable");
      expect(await repository.findByTemplateAndVersion(template.id, 1)).toEqual(saved);
    });

    it("refuses to create a version outside appendVersion", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      await expect(repository.create()).rejects.toThrow("Template versions are immutable");
      expect(await repository.listByTemplate(template.id)).toEqual([]);
    });
  });

  describe("accessibleBy", () => {
    it("returns an unfiltered copy that reads every version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      await repository.appendVersion({ templateId: template.id, sdl: "version: '2.0'" });

      const copy = repository.accessibleBy(createMongoAbility([]), "read");

      expect(copy).not.toBe(repository);
      expect(copy).toBeInstanceOf(TemplateVersionRepository);
      expect(await copy.listByTemplate(template.id)).toHaveLength(1);
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

  describe("findById", () => {
    it("returns that version with its content, or nothing for an unknown id", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const appended = await repository.appendVersion({ templateId: template.id, sdl: "sdl", readme: "# readme" });

      expect(await repository.findById(appended.id)).toEqual(appended);
      expect(await repository.findById(faker.string.uuid())).toBeUndefined();
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
        {
          id: second.id,
          templateId: template.id,
          version: 2,
          resources: null,
          status: "live",
          changes: ["readme_changed"],
          createdById: null,
          createdBy: null,
          createdAt: second.createdAt
        },
        {
          id: first.id,
          templateId: template.id,
          version: 1,
          resources: null,
          status: "live",
          changes: ["first_version"],
          createdById: null,
          createdBy: null,
          createdAt: first.createdAt
        }
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

  function sdlWithImage(image: string) {
    return JSON.stringify({ version: "2.0", services: { web: { image } } });
  }

  async function findStoredTemplate(id: string) {
    const templates = resolveTable("Templates");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).query.Templates.findFirst({ where: eq(templates.id, id) });
  }

  function setup() {
    return { repository: container.resolve(TemplateVersionRepository) };
  }
});
