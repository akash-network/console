import { Template, TemplateFavorite, UserSetting } from "@akashnetwork/database/dbSchemas/user";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";
import { Op } from "sequelize";
import { afterEach, describe, expect, it } from "vitest";

import { connectUsingSequelize } from "@src/chain";
import { toUTC } from "@src/utils";
import { UserTemplateRepository } from "./user-template.repository";

describe(UserTemplateRepository.name, () => {
  const createdUserIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const createdFavoriteIds: string[] = [];

  beforeAll(async () => {
    await connectUsingSequelize();
  });

  afterEach(async () => {
    await TemplateFavorite.destroy({
      where: {
        id: { [Op.in]: createdFavoriteIds }
      }
    });

    await Template.destroy({
      where: {
        id: { [Op.in]: createdTemplateIds }
      }
    });

    await UserSetting.destroy({
      where: {
        id: { [Op.in]: createdUserIds }
      }
    });

    createdFavoriteIds.length = 0;
    createdTemplateIds.length = 0;
    createdUserIds.length = 0;
  });

  describe("findById", () => {
    it("returns template with user setting when found", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });

      const result = await userTemplateRepository.findById(template.id);

      expect(result).toMatchObject({
        id: template.id,
        userId: user.userId,
        title: template.title,
        description: template.description || "",
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
      const template = await createTestTemplate({ userId: user.userId });
      await createTestFavorite({ userId: user.userId!, templateId: template.id });

      const result = await userTemplateRepository.isFavorite(template.id, user.userId!);

      expect(result).toBe(true);
    });

    it("returns false when template is not favorited by user", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });

      const result = await userTemplateRepository.isFavorite(template.id, user.userId!);

      expect(result).toBe(false);
    });

    it("returns false when template is favorited by different user", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const template = await createTestTemplate({ userId: user1.userId });
      await createTestFavorite({ userId: user1.userId!, templateId: template.id });

      const result = await userTemplateRepository.isFavorite(template.id, user2.userId!);

      expect(result).toBe(false);
    });
  });

  describe("deleteById", () => {
    it("deletes template by id and userId", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });

      await userTemplateRepository.deleteById(template.id, user.userId!);

      const deletedTemplate = await Template.findByPk(template.id);
      expect(deletedTemplate).toBeNull();
      // Remove from cleanup array since it's already deleted
      createdTemplateIds.splice(createdTemplateIds.indexOf(template.id), 1);
    });

    it("does not delete template if userId does not match", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const template = await createTestTemplate({ userId: user1.userId });

      await userTemplateRepository.deleteById(template.id, user2.userId!);

      const stillExists = await Template.findByPk(template.id);
      expect(stillExists).not.toBeNull();
    });
  });

  describe("removeFavorite", () => {
    it("removes favorite for user and template", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });
      const favorite = await createTestFavorite({ userId: user.userId!, templateId: template.id });

      await userTemplateRepository.removeFavorite(user.userId!, template.id);

      const deletedFavorite = await TemplateFavorite.findByPk(favorite.id);
      expect(deletedFavorite).toBeNull();
      // Remove from cleanup array since it's already deleted
      createdFavoriteIds.splice(createdFavoriteIds.indexOf(favorite.id), 1);
    });

    it("does nothing when favorite does not exist", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });

      await expect(userTemplateRepository.removeFavorite(user.userId!, template.id)).resolves.not.toThrow();
    });
  });

  describe("addFavorite", () => {
    it("adds favorite for user and template", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });

      await userTemplateRepository.addFavorite(user.userId!, template.id);

      const isFavorite = await userTemplateRepository.isFavorite(template.id, user.userId!);
      expect(isFavorite).toBe(true);

      // Add to cleanup array
      const favorite = await TemplateFavorite.findOne({ where: { userId: user.userId, templateId: template.id } });
      if (favorite) createdFavoriteIds.push(favorite.id);
    });

    it("does nothing when favorite already exists", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });
      await createTestFavorite({ userId: user.userId!, templateId: template.id });

      const favoriteCountBefore = await TemplateFavorite.count({
        where: { userId: user.userId, templateId: template.id }
      });

      await userTemplateRepository.addFavorite(user.userId!, template.id);

      const favoriteCountAfter = await TemplateFavorite.count({
        where: { userId: user.userId, templateId: template.id }
      });
      expect(favoriteCountAfter).toBe(favoriteCountBefore);
    });
  });

  describe("getFavoriteTemplates", () => {
    it("returns all favorite templates for user", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template1 = await createTestTemplate({ userId: user.userId });
      const template2 = await createTestTemplate({ userId: user.userId });
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
      const template1 = await createTestTemplate({ userId: user1.userId });
      const template2 = await createTestTemplate({ userId: user2.userId });
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

      const template = await Template.findByPk(templateId);
      expect(template).not.toBeNull();
      expect(template?.title).toBe(templateData.title);
      expect(template?.sdl).toBe(templateData.sdl);
      expect(template?.isPublic).toBe(true);
      if (template) createdTemplateIds.push(template.id);
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

      const template = await Template.findByPk(templateId);
      expect(template).not.toBeNull();
      if (template) createdTemplateIds.push(template.id);
    });

    it("updates existing template when id matches userId", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });
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
      const updatedTemplate = await Template.findByPk(template.id);
      expect(updatedTemplate?.title).toBe(newTitle);
    });

    it("creates copy with copiedFromId when id exists but userId does not match", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const originalTemplate = await createTestTemplate({ userId: user1.userId });
      const templateData = {
        sdl: faker.lorem.paragraph(),
        title: faker.lorem.words(3),
        cpu: faker.number.int({ min: 1000, max: 10000 }),
        ram: faker.number.int({ min: 1000000, max: 10000000 }),
        storage: faker.number.int({ min: 1000000, max: 100000000 })
      };

      const newTemplateId = await userTemplateRepository.upsert(originalTemplate.id, user2.userId!, templateData);

      expect(newTemplateId).not.toBe(originalTemplate.id);
      const newTemplate = await Template.findByPk(newTemplateId);
      expect(newTemplate?.copiedFromId).toBe(originalTemplate.id);
      expect(newTemplate?.userId).toBe(user2.userId);
      if (newTemplate) createdTemplateIds.push(newTemplate.id);
    });

    it("updates isPublic when provided", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId, isPublic: false });
      const templateData = {
        sdl: template.sdl,
        title: template.title,
        cpu: template.cpu,
        ram: template.ram,
        storage: template.storage,
        isPublic: true
      };

      await userTemplateRepository.upsert(template.id, user.userId!, templateData);

      const updatedTemplate = await Template.findByPk(template.id);
      expect(updatedTemplate?.isPublic).toBe(true);
    });

    it("updates description when provided", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });
      const newDescription = faker.lorem.sentence();
      const templateData = {
        sdl: template.sdl,
        title: template.title,
        cpu: template.cpu,
        ram: template.ram,
        storage: template.storage,
        description: newDescription
      };

      await userTemplateRepository.upsert(template.id, user.userId!, templateData);

      const updatedTemplate = await Template.findByPk(template.id);
      expect(updatedTemplate?.description).toBe(newDescription);
    });
  });

  describe("updateById", () => {
    it("updates template fields", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const template = await createTestTemplate({ userId: user.userId });
      const newTitle = faker.lorem.words(3);
      const newDescription = faker.lorem.sentence();

      await userTemplateRepository.updateById(template.id, user.userId!, {
        title: newTitle,
        description: newDescription
      });

      const updatedTemplate = await Template.findByPk(template.id);
      expect(updatedTemplate?.title).toBe(newTitle);
      expect(updatedTemplate?.description).toBe(newDescription);
    });

    it("does not update template if userId does not match", async () => {
      const { userTemplateRepository } = setup();
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const template = await createTestTemplate({ userId: user1.userId });
      const originalTitle = template.title;

      await userTemplateRepository.updateById(template.id, user2.userId!, {
        title: faker.lorem.words(3)
      });

      const unchangedTemplate = await Template.findByPk(template.id);
      expect(unchangedTemplate?.title).toBe(originalTitle);
    });
  });

  describe("findAllByUsername", () => {
    it("returns all public templates for user by username", async () => {
      const { userTemplateRepository } = setup();
      const user = await createTestUser();
      const publicTemplate1 = await createTestTemplate({ userId: user.userId, isPublic: true });
      const publicTemplate2 = await createTestTemplate({ userId: user.userId, isPublic: true });
      await createTestTemplate({ userId: user.userId, isPublic: false });

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
      await createTestTemplate({ userId: user.userId, isPublic: false });

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
      const publicTemplate = await createTestTemplate({ userId: user.userId, isPublic: true });
      const privateTemplate = await createTestTemplate({ userId: user.userId, isPublic: false });

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
      const template1 = await createTestTemplate({ userId: user1.userId });
      await createTestTemplate({ userId: user2.userId });

      const results = await userTemplateRepository.findAllByUserId(user1.userId!);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(template1.id);
    });
  });

  async function createTestUser(overrides: Partial<CreationAttributes<UserSetting>> = {}) {
    const user = await UserSetting.create({
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

  async function createTestTemplate(overrides: Partial<CreationAttributes<Template>> = {}) {
    const template = await Template.create({
      id: faker.string.uuid(),
      userId: overrides.userId || faker.string.uuid(),
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      sdl: faker.lorem.paragraph(),
      cpu: faker.number.int({ min: 1000, max: 10000 }),
      ram: faker.number.int({ min: 1000000, max: 10000000 }),
      storage: faker.number.int({ min: 1000000, max: 100000000 }),
      isPublic: false,
      ...overrides
    });
    createdTemplateIds.push(template.id);
    return template;
  }

  async function createTestFavorite(overrides: Partial<CreationAttributes<TemplateFavorite>> = {}) {
    const favorite = await TemplateFavorite.create({
      id: faker.string.uuid(),
      userId: overrides.userId || faker.string.uuid(),
      templateId: overrides.templateId || faker.string.uuid(),
      addedDate: toUTC(new Date()),
      ...overrides
    });
    createdFavoriteIds.push(favorite.id);
    return favorite;
  }

  function setup() {
    const userTemplateRepository = new UserTemplateRepository();
    return {
      userTemplateRepository
    };
  }
});
