import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { type TemplateInput, UserTemplateRepository } from "./user-template.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(UserTemplateRepository.name, () => {
  const createdUserIds: string[] = [];
  const createdTemplateIds: string[] = [];

  afterEach(async () => {
    const { userTemplateRepository } = setup();
    const userRepository = container.resolve(UserRepository);

    if (createdTemplateIds.length > 0) {
      await userTemplateRepository.deleteById(createdTemplateIds);
    }
    if (createdUserIds.length > 0) {
      await userRepository.deleteById(createdUserIds);
    }

    createdTemplateIds.length = 0;
    createdUserIds.length = 0;
  });

  describe("findById", () => {
    it("returns template with user setting when found", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });

      const result = await userTemplateRepository.findById(template.id, user.userId!);

      expect(result).toMatchObject({
        id: template.id,
        userId: user.userId,
        title: template.title,
        description: template.description,
        cpu: template.cpu,
        ram: template.ram,
        storage: template.storage,
        sdl: template.sdl,
        username: user.username,
        isPublic: template.isPublic
      });
    });

    it("returns undefined when template not found", async () => {
      const { userTemplateRepository } = setup();

      const result = await userTemplateRepository.findById(faker.string.uuid());

      expect(result).toBeUndefined();
    });
  });

  describe("isFavorite", () => {
    it("returns true when template is favorited by user", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });
      await createTestFavorite({ userId: user.userId!, templateId: template.id });

      const result = await userTemplateRepository.isFavorite(template.id, user.userId!);

      expect(result).toBe(true);
    });

    it("returns false when template is not favorited by user", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });

      const result = await userTemplateRepository.isFavorite(template.id, user.userId!);

      expect(result).toBe(false);
    });

    it("returns false when template is favorited by different user", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const template = await createTestTemplate({ userId: user1.userId! });
      await createTestFavorite({ userId: user1.userId!, templateId: template.id });

      const result = await userTemplateRepository.isFavorite(template.id, user2.userId!);

      expect(result).toBe(false);
    });
  });

  describe("deleteById", () => {
    it("deletes template by id and userId", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });

      await userTemplateRepository.deleteById(template.id, user.userId!);

      const deleted = await findStoredTemplate(template.id);
      expect(deleted).toBeUndefined();
    });

    it("does not delete template if userId does not match", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const template = await createTestTemplate({ userId: user1.userId! });

      await userTemplateRepository.deleteById(template.id, user2.userId!);

      const stillExists = await findStoredTemplate(template.id);
      expect(stillExists).toBeDefined();
    });
  });

  describe("removeFavorite", () => {
    it("removes favorite for user and template", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });
      await createTestFavorite({ userId: user.userId!, templateId: template.id });

      await userTemplateRepository.removeFavorite(user.userId!, template.id);

      const isFavorite = await userTemplateRepository.isFavorite(template.id, user.userId!);
      expect(isFavorite).toBe(false);
    });

    it("does nothing when favorite does not exist", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });

      await expect(userTemplateRepository.removeFavorite(user.userId!, template.id)).resolves.not.toThrow();
    });
  });

  describe("addFavorite", () => {
    it("records no favorite on a private template of another user", async () => {
      const { userTemplateRepository } = setup();
      const author = await createTestUser();
      const reader = await createTestUser();
      const template = await createTestTemplate({ userId: author.userId! });

      await userTemplateRepository.addFavorite(reader.userId!, template.id);

      expect(await userTemplateRepository.isFavorite(template.id, reader.userId!)).toBe(false);
    });

    it("records a favorite on a public template of another user", async () => {
      const { userTemplateRepository } = setup();
      const author = await createTestUser();
      const reader = await createTestUser();
      const template = await createTestTemplate({ userId: author.userId!, isPublic: true });

      await userTemplateRepository.addFavorite(reader.userId!, template.id);

      expect(await userTemplateRepository.isFavorite(template.id, reader.userId!)).toBe(true);
    });

    it("adds favorite for user and template", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });

      await userTemplateRepository.addFavorite(user.userId!, template.id);

      const isFavorite = await userTemplateRepository.isFavorite(template.id, user.userId!);
      expect(isFavorite).toBe(true);
    });

    it("does nothing when favorite already exists", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });
      await createTestFavorite({ userId: user.userId!, templateId: template.id });

      await expect(userTemplateRepository.addFavorite(user.userId!, template.id)).resolves.not.toThrow();

      const isFavorite = await userTemplateRepository.isFavorite(template.id, user.userId!);
      expect(isFavorite).toBe(true);
    });
  });

  describe("findById for a reader", () => {
    it("returns a public template to anyone, signed in or not", async () => {
      const { userTemplateRepository } = setup();
      const author = await createTestUser();
      const reader = await createTestUser();
      const template = await createTestTemplate({ userId: author.userId!, isPublic: true });

      expect(await userTemplateRepository.findById(template.id, reader.userId!)).toMatchObject({ id: template.id });
      expect(await userTemplateRepository.findById(template.id, "")).toMatchObject({ id: template.id });
    });

    it("returns a private template to its author", async () => {
      const { userTemplateRepository } = setup();
      const author = await createTestUser();
      const template = await createTestTemplate({ userId: author.userId! });

      expect(await userTemplateRepository.findById(template.id, author.userId!)).toMatchObject({ id: template.id, username: author.username });
    });

    it("keeps a private template from another user and from anonymous visitors", async () => {
      const { userTemplateRepository } = setup();
      const author = await createTestUser();
      const reader = await createTestUser();
      const template = await createTestTemplate({ userId: author.userId! });

      expect(await userTemplateRepository.findById(template.id, reader.userId!)).toBeUndefined();
      expect(await userTemplateRepository.findById(template.id, "")).toBeUndefined();
    });

    it("returns a private template to its author only inside the active organization, in organization mode", async () => {
      const { userTemplateRepository } = setup();
      const author = await createTestUser();
      const [active, other] = await Promise.all([seedOrganization(), seedOrganization()]);
      const activeTemplate = await createTestTemplate({ userId: author.userId! }, active.id);
      const otherTemplate = await createTestTemplate({ userId: author.userId! }, other.id);

      const [readable, hidden] = await runInOrganization(active.id, () =>
        Promise.all([userTemplateRepository.findById(activeTemplate.id, author.userId!), userTemplateRepository.findById(otherTemplate.id, author.userId!)])
      );

      expect(readable).toMatchObject({ id: activeTemplate.id });
      expect(hidden).toBeUndefined();
    });

    it("keeps a private template from another member of the same organization, in organization mode", async () => {
      const { userTemplateRepository } = setup();
      const author = await createTestUser();
      const colleague = await createTestUser();
      const organization = await seedOrganization();
      const template = await createTestTemplate({ userId: author.userId! }, organization.id);

      const result = await runInOrganization(organization.id, () => userTemplateRepository.findById(template.id, colleague.userId!));

      expect(result).toBeUndefined();
    });
  });

  describe("getFavoriteTemplates", () => {
    it("leaves out another user's private template marked as favorite", async () => {
      const { userTemplateRepository } = setup();
      const author = await createTestUser();
      const reader = await createTestUser();
      const privateTemplate = await createTestTemplate({ userId: author.userId! });
      const publicTemplate = await createTestTemplate({ userId: author.userId!, isPublic: true });
      await recordFavorite({ userId: reader.userId!, templateId: privateTemplate.id });
      await recordFavorite({ userId: reader.userId!, templateId: publicTemplate.id });

      const results = await userTemplateRepository.getFavoriteTemplates(reader.userId!);

      expect(results.map(t => t.id)).toEqual([publicTemplate.id]);
    });

    it("returns all favorite templates for user", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template1 = await createTestTemplate({ userId: user.userId! });
      const template2 = await createTestTemplate({ userId: user.userId! });
      await createTestFavorite({ userId: user.userId!, templateId: template1.id });
      await createTestFavorite({ userId: user.userId!, templateId: template2.id });

      const results = await userTemplateRepository.getFavoriteTemplates(user.userId!);

      expect(results).toHaveLength(2);
      expect(results.map(t => t.id)).toEqual(expect.arrayContaining([template1.id, template2.id]));
    });

    it("returns empty array when user has no favorites", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();

      const results = await userTemplateRepository.getFavoriteTemplates(user.userId!);

      expect(results).toEqual([]);
    });

    it("returns only favorites for specified user", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const template1 = await createTestTemplate({ userId: user1.userId! });
      const template2 = await createTestTemplate({ userId: user2.userId! });
      await createTestFavorite({ userId: user1.userId!, templateId: template1.id });
      await createTestFavorite({ userId: user2.userId!, templateId: template2.id });

      const results = await userTemplateRepository.getFavoriteTemplates(user1.userId!);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(template1.id);
    });
  });

  describe("upsert", () => {
    it("creates new template when id is not provided", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const templateData = {
        sdl: faker.lorem.paragraph(),
        title: faker.lorem.words(3),
        cpu: faker.number.int({ min: 1000, max: 10000 }),
        ram: faker.number.int({ min: 1000000, max: 10000000 }),
        storage: faker.number.int({ min: 1000000, max: 100000000 }),
        isPublic: true,
        description: faker.lorem.sentence()
      };

      const templateId = await userTemplateRepository.upsert(undefined, user.userId!, templateData);
      createdTemplateIds.push(templateId);

      const template = await findStoredTemplate(templateId);
      expect(template).toBeDefined();
      expect(template?.title).toBe(templateData.title);
      expect(template?.sdl).toBe(templateData.sdl);
      expect(template?.isPublic).toBe(true);
    });

    it("creates new template when id is null", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const templateData = {
        sdl: faker.lorem.paragraph(),
        title: faker.lorem.words(3),
        cpu: faker.number.int({ min: 1000, max: 10000 }),
        ram: faker.number.int({ min: 1000000, max: 10000000 }),
        storage: faker.number.int({ min: 1000000, max: 100000000 })
      };

      const templateId = await userTemplateRepository.upsert(null, user.userId!, templateData);
      createdTemplateIds.push(templateId);

      const template = await findStoredTemplate(templateId);
      expect(template).toBeDefined();
    });

    it("updates existing template when id matches userId", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });
      const newTitle = faker.lorem.words(3);
      const templateData = {
        sdl: template.sdl,
        title: newTitle,
        cpu: template.cpu,
        ram: template.ram,
        storage: template.storage
      };

      const templateId = await userTemplateRepository.upsert(template.id, user.userId!, templateData);

      expect(templateId).toBe(template.id);
      const updatedTemplate = await findStoredTemplate(template.id);
      expect(updatedTemplate?.title).toBe(newTitle);
    });

    it("creates copy with copiedFromId when id exists but userId does not match", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const originalTemplate = await createTestTemplate({ userId: user1.userId! });
      const templateData = {
        sdl: faker.lorem.paragraph(),
        title: faker.lorem.words(3),
        cpu: faker.number.int({ min: 1000, max: 10000 }),
        ram: faker.number.int({ min: 1000000, max: 10000000 }),
        storage: faker.number.int({ min: 1000000, max: 100000000 })
      };

      const newTemplateId = await userTemplateRepository.upsert(originalTemplate.id, user2.userId!, templateData);
      createdTemplateIds.push(newTemplateId);

      expect(newTemplateId).not.toBe(originalTemplate.id);
      const newTemplate = await findStoredTemplate(newTemplateId);
      expect(newTemplate?.userId).toBe(user2.userId);
    });

    it("creates the copy under a new id when the submitted template still carries the original's id", async () => {
      const { userTemplateRepository } = setup();
      const owner = await createTestUser();
      const copier = await createTestUser();
      const originalTemplate = await createTestTemplate({ userId: owner.userId! });
      const submittedTemplate = {
        id: originalTemplate.id,
        sdl: faker.lorem.paragraph(),
        title: faker.lorem.words(3),
        cpu: faker.number.int({ min: 1000, max: 10000 }),
        ram: faker.number.int({ min: 1000000, max: 10000000 }),
        storage: faker.number.int({ min: 1000000, max: 100000000 })
      };

      const copyId = await userTemplateRepository.upsert(submittedTemplate.id, copier.userId!, submittedTemplate);
      createdTemplateIds.push(copyId);

      expect(copyId).not.toBe(originalTemplate.id);
      expect(await findStoredTemplate(copyId)).toMatchObject({ userId: copier.userId, title: submittedTemplate.title });
      expect(await findStoredTemplate(originalTemplate.id)).toMatchObject({ userId: owner.userId, title: originalTemplate.title });
    });

    it("updates isPublic when provided", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId!, isPublic: false });

      await userTemplateRepository.upsert(template.id, user.userId!, {
        sdl: template.sdl,
        title: template.title,
        cpu: template.cpu,
        ram: template.ram,
        storage: template.storage,
        isPublic: true
      });

      const updatedTemplate = await findStoredTemplate(template.id);
      expect(updatedTemplate?.isPublic).toBe(true);
    });

    it("updates description when provided", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });
      const newDescription = faker.lorem.sentence();

      await userTemplateRepository.upsert(template.id, user.userId!, {
        sdl: template.sdl,
        title: template.title,
        cpu: template.cpu,
        ram: template.ram,
        storage: template.storage,
        description: newDescription
      });

      const updatedTemplate = await findStoredTemplate(template.id);
      expect(updatedTemplate?.description).toBe(newDescription);
    });
  });

  describe("updateTemplate", () => {
    it("updates template fields", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId! });
      const newTitle = faker.lorem.words(3);
      const newDescription = faker.lorem.sentence();

      await userTemplateRepository.updateTemplate(template.id, user.userId!, {
        title: newTitle,
        description: newDescription
      });

      const updatedTemplate = await findStoredTemplate(template.id);
      expect(updatedTemplate?.title).toBe(newTitle);
      expect(updatedTemplate?.description).toBe(newDescription);
    });

    it("does not update template if userId does not match", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const template = await createTestTemplate({ userId: user1.userId! });

      await userTemplateRepository.updateTemplate(template.id, user2.userId!, {
        title: faker.lorem.words(3)
      });

      const unchangedTemplate = await findStoredTemplate(template.id);
      expect(unchangedTemplate?.title).toBe(template.title);
    });
  });

  describe("findAllByUsername", () => {
    it("returns all public templates for user by username", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const publicTemplate1 = await createTestTemplate({ userId: user.userId!, isPublic: true });
      const publicTemplate2 = await createTestTemplate({ userId: user.userId!, isPublic: true });
      await createTestTemplate({ userId: user.userId!, isPublic: false });

      const results = await userTemplateRepository.findAllByUsername(user.username!);

      expect(results).toHaveLength(2);
      expect(results.map(t => t.id)).toEqual(expect.arrayContaining([publicTemplate1.id, publicTemplate2.id]));
      results.forEach(result => {
        expect(result.username).toBe(user.username);
      });
    });

    it("returns empty array when user has no public templates", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      await createTestTemplate({ userId: user.userId!, isPublic: false });

      const results = await userTemplateRepository.findAllByUsername(user.username!);

      expect(results).toEqual([]);
    });

    it("returns empty array when username does not exist", async () => {
      const { userTemplateRepository } = setup();

      const results = await userTemplateRepository.findAllByUsername("nonexistentuser");

      expect(results).toEqual([]);
    });
  });

  describe("findAllByUserId", () => {
    it("returns all templates for user including private ones", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const publicTemplate = await createTestTemplate({ userId: user.userId!, isPublic: true });
      const privateTemplate = await createTestTemplate({ userId: user.userId!, isPublic: false });

      const results = await userTemplateRepository.findAllByUserId(user.userId!);

      expect(results).toHaveLength(2);
      expect(results.map(t => t.id)).toEqual(expect.arrayContaining([publicTemplate.id, privateTemplate.id]));
    });

    it("returns empty array when user has no templates", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();

      const results = await userTemplateRepository.findAllByUserId(user.userId!);

      expect(results).toEqual([]);
    });

    it("returns only templates for specified user", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const template1 = await createTestTemplate({ userId: user1.userId! });
      await createTestTemplate({ userId: user2.userId! });

      const results = await userTemplateRepository.findAllByUserId(user1.userId!);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(template1.id);
    });
  });

  async function createTestUser(overrides: { userId?: string; username?: string; email?: string; emailVerified?: boolean } = {}) {
    const userRepository = container.resolve(UserRepository);
    const user = await userRepository.create({
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      username: `testuser_${Date.now()}_${faker.string.alphanumeric(6)}`,
      email: faker.internet.email(),
      emailVerified: faker.datatype.boolean(),
      subscribedToNewsletter: false,
      ...overrides
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function createTestTemplate(overrides: { userId: string } & Partial<TemplateInput>, organizationId?: string) {
    const { userId, ...data } = overrides;
    const { userTemplateRepository } = setup();
    const upsert = () =>
      userTemplateRepository.upsert(undefined, userId, {
        sdl: faker.lorem.paragraph(),
        title: faker.lorem.words(3),
        description: faker.lorem.sentence(),
        cpu: faker.number.int({ min: 1000, max: 10000 }),
        ram: faker.number.int({ min: 1000000, max: 10000000 }),
        storage: faker.number.int({ min: 1000000, max: 100000000 }),
        isPublic: false,
        ...data
      });
    const id = organizationId ? await runInOrganization(organizationId, upsert) : await upsert();
    const template = await findStoredTemplate(id);
    createdTemplateIds.push(id);
    return template!;
  }

  async function findStoredTemplate(id: string) {
    const templates = resolveTable("Templates");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).query.Templates.findFirst({ where: eq(templates.id, id) });
  }

  async function recordFavorite({ userId, templateId }: { userId: string; templateId: string }) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("TemplateFavorites"))
      .values({ id: faker.string.uuid(), userId, templateId, addedDate: new Date() });
  }

  async function runInOrganization<R>(organizationId: string, run: () => Promise<R>) {
    const executionContextService = container.resolve(ExecutionContextService);

    return await executionContextService.runWithContext(async () => {
      executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId }));
      return await run();
    });
  }

  async function createTestFavorite(params: { userId: string; templateId: string }) {
    const { userTemplateRepository } = setup();
    await userTemplateRepository.addFavorite(params.userId, params.templateId);
  }

  function setup() {
    const userTemplateRepository = container.resolve(UserTemplateRepository);
    return { userTemplateRepository };
  }
});
