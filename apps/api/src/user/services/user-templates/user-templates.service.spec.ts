import { faker } from "@faker-js/faker";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";

import type { TemplateInput, TemplateOutput, UserTemplateRepository } from "../../repositories/user-template/user-template.repository";
import { UserTemplatesService } from "./user-templates.service";

describe(UserTemplatesService.name, () => {
  describe("getTemplateById", () => {
    it("returns null when template is not found", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();

      userTemplateRepository.findById.mockResolvedValue(undefined);

      const result = await service.getTemplateById(templateId);

      expect(result).toBeNull();
      expect(userTemplateRepository.findById).toHaveBeenCalledWith(templateId);
    });

    it("returns null when template is private and user is not the owner", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();
      const ownerId = faker.string.uuid();
      const requestingUserId = faker.string.uuid();

      userTemplateRepository.findById.mockResolvedValue(createTemplateOutput({ id: templateId, userId: ownerId, isPublic: false }));

      const result = await service.getTemplateById(templateId, requestingUserId);

      expect(result).toBeNull();
    });

    it("returns template without isFavorite when userId is not provided", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();
      const template = createTemplateOutput({ id: templateId, isPublic: true });

      userTemplateRepository.findById.mockResolvedValue(template);

      const result = await service.getTemplateById(templateId);

      expect(result).toEqual(template);
      expect(userTemplateRepository.isFavorite).not.toHaveBeenCalled();
    });

    it("returns template with isFavorite when userId is provided", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();
      const userId = faker.string.uuid();
      const template = createTemplateOutput({ id: templateId, isPublic: true });

      userTemplateRepository.findById.mockResolvedValue(template);
      userTemplateRepository.isFavorite.mockResolvedValue(true);

      const result = await service.getTemplateById(templateId, userId);

      expect(result).toEqual({ ...template, isFavorite: true });
      expect(userTemplateRepository.isFavorite).toHaveBeenCalledWith(templateId, userId);
    });

    it("returns private template when user is the owner", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();
      const userId = faker.string.uuid();
      const template = createTemplateOutput({ id: templateId, userId, isPublic: false });

      userTemplateRepository.findById.mockResolvedValue(template);
      userTemplateRepository.isFavorite.mockResolvedValue(false);

      const result = await service.getTemplateById(templateId, userId);

      expect(result).toEqual({ ...template, isFavorite: false });
    });
  });

  describe("getTemplates", () => {
    it("returns templates by userId when userId is provided", async () => {
      const { service, userTemplateRepository } = setup();
      const username = faker.internet.userName();
      const userId = faker.string.uuid();
      const templates = [createTemplateOutput(), createTemplateOutput()];

      userTemplateRepository.findAllByUserId.mockResolvedValue(templates);

      const result = await service.getTemplates(username, userId);

      expect(result).toEqual(templates);
      expect(userTemplateRepository.findAllByUserId).toHaveBeenCalledWith(userId);
      expect(userTemplateRepository.findAllByUsername).not.toHaveBeenCalled();
    });

    it("returns templates by username when userId is not provided", async () => {
      const { service, userTemplateRepository } = setup();
      const username = faker.internet.userName();
      const templates = [createTemplateOutput(), createTemplateOutput()];

      userTemplateRepository.findAllByUsername.mockResolvedValue(templates);

      const result = await service.getTemplates(username);

      expect(result).toEqual(templates);
      expect(userTemplateRepository.findAllByUsername).toHaveBeenCalledWith(username);
      expect(userTemplateRepository.findAllByUserId).not.toHaveBeenCalled();
    });
  });

  describe("saveTemplate", () => {
    it("calls repository upsert with correct parameters", async () => {
      const { service, userTemplateRepository } = setup();
      const id = faker.string.uuid();
      const userId = faker.string.uuid();
      const newTemplateId = faker.string.uuid();
      const data: TemplateInput = {
        sdl: faker.lorem.paragraph(),
        title: faker.lorem.words(3),
        cpu: faker.number.int({ min: 1, max: 8 }),
        ram: faker.number.int({ min: 512, max: 8192 }),
        storage: faker.number.int({ min: 1, max: 100 }),
        isPublic: true,
        description: faker.lorem.sentence()
      };

      userTemplateRepository.upsert.mockResolvedValue(newTemplateId);

      const result = await service.saveTemplate(id, userId, data);

      expect(result).toBe(newTemplateId);
      expect(userTemplateRepository.upsert).toHaveBeenCalledWith(id, userId, data);
    });
  });

  describe("update", () => {
    it("calls repository updateById with correct parameters", async () => {
      const { service, userTemplateRepository } = setup();
      const id = faker.string.uuid();
      const userId = faker.string.uuid();
      const data: Partial<TemplateInput> = {
        title: faker.lorem.words(3),
        description: faker.lorem.sentence()
      };

      userTemplateRepository.updateById.mockResolvedValue();

      await service.update(id, userId, data);

      expect(userTemplateRepository.updateById).toHaveBeenCalledWith(id, userId, data);
    });
  });

  describe("deleteTemplate", () => {
    it("calls repository deleteById with correct parameters", async () => {
      const { service, userTemplateRepository } = setup();
      const userId = faker.string.uuid();
      const id = faker.string.uuid();

      userTemplateRepository.deleteById.mockResolvedValue();

      await service.deleteTemplate(userId, id);

      expect(userTemplateRepository.deleteById).toHaveBeenCalledWith(id, userId);
    });
  });

  describe("getFavoriteTemplates", () => {
    it("returns mapped favorite templates with id, title, and description", async () => {
      const { service, userTemplateRepository } = setup();
      const userId = faker.string.uuid();
      const templates = [
        createTemplateOutput({ id: "1", title: "Template 1", description: "Desc 1" }),
        createTemplateOutput({ id: "2", title: "Template 2", description: "Desc 2" })
      ];

      userTemplateRepository.getFavoriteTemplates.mockResolvedValue(templates);

      const result = await service.getFavoriteTemplates(userId);

      expect(result).toEqual([
        { id: "1", title: "Template 1", description: "Desc 1" },
        { id: "2", title: "Template 2", description: "Desc 2" }
      ]);
      expect(userTemplateRepository.getFavoriteTemplates).toHaveBeenCalledWith(userId);
    });

    it("returns empty array when no favorites exist", async () => {
      const { service, userTemplateRepository } = setup();
      const userId = faker.string.uuid();

      userTemplateRepository.getFavoriteTemplates.mockResolvedValue([]);

      const result = await service.getFavoriteTemplates(userId);

      expect(result).toEqual([]);
    });
  });

  describe("addFavoriteTemplate", () => {
    it("calls repository addFavorite with correct parameters", async () => {
      const { service, userTemplateRepository } = setup();
      const userId = faker.string.uuid();
      const templateId = faker.string.uuid();

      userTemplateRepository.addFavorite.mockResolvedValue();

      await service.addFavoriteTemplate(userId, templateId);

      expect(userTemplateRepository.addFavorite).toHaveBeenCalledWith(userId, templateId);
    });
  });

  describe("removeFavoriteTemplate", () => {
    it("calls repository removeFavorite with correct parameters", async () => {
      const { service, userTemplateRepository } = setup();
      const userId = faker.string.uuid();
      const templateId = faker.string.uuid();

      userTemplateRepository.removeFavorite.mockResolvedValue();

      await service.removeFavoriteTemplate(userId, templateId);

      expect(userTemplateRepository.removeFavorite).toHaveBeenCalledWith(userId, templateId);
    });
  });

  function setup() {
    const userTemplateRepository: MockProxy<UserTemplateRepository> = mock<UserTemplateRepository>();
    const service = new UserTemplatesService(userTemplateRepository);

    return { service, userTemplateRepository };
  }

  function createTemplateOutput(overrides?: Partial<TemplateOutput>): TemplateOutput {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      cpu: faker.number.int({ min: 1, max: 8 }),
      ram: faker.number.int({ min: 512, max: 8192 }),
      storage: faker.number.int({ min: 1, max: 100 }),
      sdl: faker.lorem.paragraph(),
      username: faker.internet.userName(),
      isPublic: faker.datatype.boolean(),
      ...overrides
    };
  }
});
