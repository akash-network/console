import { createMongoAbility, ForbiddenError, type MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";
import type { TemplateInput, TemplateOutput, UserTemplateRepository } from "../../repositories/user-template/user-template.repository";
import { UserTemplatesService } from "./user-templates.service";

describe(UserTemplatesService.name, () => {
  describe("getTemplateById", () => {
    it("returns null when no template with that id is readable by an anonymous visitor", async () => {
      const { service, userTemplateRepository } = setup();
      const templateId = faker.string.uuid();

      userTemplateRepository.findById.mockResolvedValue(undefined);

      const result = await service.getTemplateById(templateId);

      expect(result).toBeNull();
      expect(userTemplateRepository.findById).toHaveBeenCalledWith(templateId, "");
    });

    it("returns null when the template is not readable by the requesting user", async () => {
      const { service, userTemplateRepository, ability } = setup();
      const templateId = faker.string.uuid();
      const requestingUserId = faker.string.uuid();

      userTemplateRepository.findById.mockResolvedValue(undefined);

      const result = await service.getTemplateById(templateId, requestingUserId);

      expect(result).toBeNull();
      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(userTemplateRepository.findById).toHaveBeenCalledWith(templateId, requestingUserId);
      expect(userTemplateRepository.isFavorite).not.toHaveBeenCalled();
    });

    it("reads public templates only for a caller whose rules reach no template", async () => {
      const { service, userTemplateRepository } = setup({ canReadTemplates: false });
      const templateId = faker.string.uuid();

      userTemplateRepository.findById.mockResolvedValue(undefined);

      await service.getTemplateById(templateId, faker.string.uuid());

      expect(userTemplateRepository.accessibleBy).not.toHaveBeenCalled();
      expect(userTemplateRepository.findById).toHaveBeenCalledWith(templateId, "");
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
      const { service, userTemplateRepository, ability } = setup();
      const username = faker.internet.userName();
      const userId = faker.string.uuid();
      const templates = [createTemplateOutput(), createTemplateOutput()];

      userTemplateRepository.findAllByUserId.mockResolvedValue(templates);

      const result = await service.getTemplates(username, userId);

      expect(result).toEqual(templates);
      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(userTemplateRepository.findAllByUserId).toHaveBeenCalledWith(userId);
      expect(userTemplateRepository.findAllByUsername).not.toHaveBeenCalled();
    });

    it("returns nothing to a signed-in caller whose rules reach no template", async () => {
      const { service, userTemplateRepository } = setup({ canReadTemplates: false });

      const result = await service.getTemplates(faker.internet.userName(), faker.string.uuid());

      expect(result).toEqual([]);
      expect(userTemplateRepository.findAllByUserId).not.toHaveBeenCalled();
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
    it("changes the caller's own template under their update rules and leaves its project alone", async () => {
      const { service, userTemplateRepository, deploymentProjectService, ability } = setup();
      const id = faker.string.uuid();
      const userId = faker.string.uuid();
      const data = createTemplateInput();

      userTemplateRepository.isAuthoredBy.mockResolvedValue(true);

      const result = await service.saveTemplate(id, userId, { ...data, projectId: faker.string.uuid() });

      expect(result).toBe(id);
      expect(userTemplateRepository.isAuthoredBy).toHaveBeenCalledWith(id, userId);
      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith(id, userId, data);
      expect(userTemplateRepository.createTemplate).not.toHaveBeenCalled();
      expect(deploymentProjectService.resolveFilingProject).not.toHaveBeenCalled();
    });

    it("creates a template under the caller's create rules in the project resolved for templates", async () => {
      const { service, userTemplateRepository, deploymentProjectService, ability } = setup();
      const userId = faker.string.uuid();
      const [requestedProjectId, filingProjectId, newTemplateId] = [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()];
      const data = createTemplateInput();

      deploymentProjectService.resolveFilingProject.mockResolvedValue(filingProjectId);
      userTemplateRepository.createTemplate.mockResolvedValue(newTemplateId);

      const result = await service.saveTemplate(undefined, userId, { ...data, projectId: requestedProjectId });

      expect(result).toBe(newTemplateId);
      expect(userTemplateRepository.isAuthoredBy).not.toHaveBeenCalled();
      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "create");
      expect(deploymentProjectService.resolveFilingProject).toHaveBeenCalledWith(requestedProjectId, "Template");
      expect(userTemplateRepository.createTemplate).toHaveBeenCalledWith(userId, data, { projectId: filingProjectId, copiedFromId: undefined });
    });

    it("saves a template the caller did not author as a copy of it", async () => {
      const { service, userTemplateRepository } = setup();
      const id = faker.string.uuid();
      const userId = faker.string.uuid();
      const data = createTemplateInput();

      userTemplateRepository.isAuthoredBy.mockResolvedValue(false);

      await service.saveTemplate(id, userId, data);

      expect(userTemplateRepository.updateTemplate).not.toHaveBeenCalled();
      expect(userTemplateRepository.createTemplate).toHaveBeenCalledWith(userId, data, { projectId: undefined, copiedFromId: id });
    });

    it("refuses a caller who may create no template before resolving a project", async () => {
      const { service, userTemplateRepository, deploymentProjectService } = setup();

      userTemplateRepository.accessibleBy.mockImplementation(() => {
        throw new ForbiddenError(createMongoAbility());
      });

      await expect(service.saveTemplate(undefined, faker.string.uuid(), createTemplateInput())).rejects.toBeInstanceOf(ForbiddenError);
      expect(deploymentProjectService.resolveFilingProject).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("calls repository updateById with correct parameters", async () => {
      const { service, userTemplateRepository, ability } = setup();
      const id = faker.string.uuid();
      const userId = faker.string.uuid();
      const data: Partial<TemplateInput> = {
        title: faker.lorem.words(3),
        description: faker.lorem.sentence()
      };

      userTemplateRepository.updateTemplate.mockResolvedValue();

      await service.update(id, userId, data);

      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(userTemplateRepository.updateTemplate).toHaveBeenCalledWith(id, userId, data);
    });
  });

  describe("deleteTemplate", () => {
    it("calls repository deleteById with correct parameters", async () => {
      const { service, userTemplateRepository, ability } = setup();
      const userId = faker.string.uuid();
      const id = faker.string.uuid();

      userTemplateRepository.deleteById.mockResolvedValue();

      await service.deleteTemplate(userId, id);

      expect(userTemplateRepository.accessibleBy).toHaveBeenCalledWith(ability, "delete");
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
      expect(userTemplateRepository.getFavoriteTemplates).toHaveBeenCalledWith(userId, userId);
    });

    it("leaves private favorites out for a caller whose rules reach no template", async () => {
      const { service, userTemplateRepository } = setup({ canReadTemplates: false });
      const userId = faker.string.uuid();

      userTemplateRepository.getFavoriteTemplates.mockResolvedValue([]);

      await service.getFavoriteTemplates(userId);

      expect(userTemplateRepository.accessibleBy).not.toHaveBeenCalled();
      expect(userTemplateRepository.getFavoriteTemplates).toHaveBeenCalledWith(userId, "");
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

      expect(userTemplateRepository.addFavorite).toHaveBeenCalledWith(userId, templateId, userId);
    });

    it("marks only a public template as favorite for a caller whose rules reach no template", async () => {
      const { service, userTemplateRepository } = setup({ canReadTemplates: false });
      const userId = faker.string.uuid();
      const templateId = faker.string.uuid();

      await service.addFavoriteTemplate(userId, templateId);

      expect(userTemplateRepository.addFavorite).toHaveBeenCalledWith(userId, templateId, "");
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

  function setup(input: { canReadTemplates?: boolean } = {}) {
    const ability = createMongoAbility<MongoAbility>(input.canReadTemplates === false ? [] : [{ action: "read", subject: "Template" }]);
    const userTemplateRepository: MockProxy<UserTemplateRepository> = mock<UserTemplateRepository>();
    userTemplateRepository.accessibleBy.mockReturnValue(userTemplateRepository);
    const authService = mock<AuthService>();
    authService.ability = ability;
    const deploymentProjectService = mock<DeploymentProjectService>();
    const service = new UserTemplatesService(userTemplateRepository, authService, deploymentProjectService);

    return { service, userTemplateRepository, deploymentProjectService, ability };
  }

  function createTemplateInput(): TemplateInput {
    return {
      sdl: faker.lorem.paragraph(),
      title: faker.lorem.words(3),
      cpu: faker.number.int({ min: 1, max: 8 }),
      ram: faker.number.int({ min: 512, max: 8192 }),
      storage: faker.number.int({ min: 1, max: 100 }),
      isPublic: true,
      description: faker.lorem.sentence()
    };
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
