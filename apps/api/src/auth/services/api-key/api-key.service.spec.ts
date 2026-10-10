import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { ApiKeyService } from "./api-key.service";
import type { ApiKeyGeneratorService } from "./api-key-generator.service";

import { createApiKey } from "@test/seeders/api-key.seeder";
import { createProject } from "@test/seeders/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(ApiKeyService.name, () => {
  describe("findAll", () => {
    it("lists the caller's keys with the caller's ability", async () => {
      const { service, apiKeyRepository, ability, user } = setup();
      const keys = [createApiKey({ userId: user.id })];
      apiKeyRepository.find.mockResolvedValue(keys);

      const result = await service.findAll();

      expect(result).toBe(keys);
      expect(apiKeyRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(apiKeyRepository.find).toHaveBeenCalledWith({ userId: user.id });
    });

    it("lists only the keys bound to the project of the key the request authenticated with", async () => {
      const projectId = faker.string.uuid();
      const { service, apiKeyRepository, user } = setup({ currentApiKey: createApiKey({ projectId }) });
      apiKeyRepository.find.mockResolvedValue([]);

      await service.findAll();

      expect(apiKeyRepository.find).toHaveBeenCalledWith({ userId: user.id, projectId });
    });
  });

  describe("findById", () => {
    it("finds a key among the caller's keys", async () => {
      const { service, apiKeyRepository, ability, user } = setup({ currentApiKey: createApiKey({ projectId: null }) });
      const key = createApiKey({ userId: user.id });
      apiKeyRepository.findOneBy.mockResolvedValue(key);

      const result = await service.findById(key.id);

      expect(result).toBe(key);
      expect(apiKeyRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(apiKeyRepository.findOneBy).toHaveBeenCalledWith({ id: key.id, userId: user.id });
    });

    it("finds a key only among the keys bound to the project of the key the request authenticated with", async () => {
      const projectId = faker.string.uuid();
      const { service, apiKeyRepository, user } = setup({ currentApiKey: createApiKey({ projectId }) });
      const id = faker.string.uuid();
      apiKeyRepository.findOneBy.mockResolvedValue(undefined);

      const result = await service.findById(id);

      expect(result).toBeUndefined();
      expect(apiKeyRepository.findOneBy).toHaveBeenCalledWith({ id, userId: user.id, projectId });
    });
  });

  describe("create", () => {
    it("creates a key bound to no project when none is requested", async () => {
      const { service, apiKeyRepository, projectRepository, ability, user, apiKeyGenerator } = setup();
      const created = createApiKey({ userId: user.id });
      apiKeyRepository.create.mockResolvedValue(created);

      const result = await service.create({ name: "ci" });

      expect(result).toEqual({ ...created, apiKey: apiKeyGenerator.generateApiKey() });
      expect(apiKeyRepository.accessibleBy).toHaveBeenCalledWith(ability, "create");
      expect(apiKeyRepository.create).toHaveBeenCalledWith({
        name: "ci",
        userId: user.id,
        projectId: null,
        hashedKey: "hashed-key",
        keyFormat: "obfuscated-key",
        expiresAt: undefined,
        lastUsedAt: null
      });
      expect(projectRepository.findOneBy).not.toHaveBeenCalled();
    });

    it("binds the key to a reachable project of the active organization", async () => {
      const project = createProject();
      const { service, apiKeyRepository, projectRepository, featureFlagsService, ability, user } = setup({ project });

      await service.create({ name: "ci", projectId: project.id });

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.ORGANIZATIONS, { userId: user.id });
      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ id: project.id, deletedAt: null });
      expect(apiKeyRepository.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id }));
    });

    it("binds the key to a project inside the request's project scope", async () => {
      const project = createProject();
      const { service, apiKeyRepository } = setup({
        project,
        organizationContext: createOrganizationContext({ projectScope: { kind: "projects", projectIds: [project.id] } })
      });

      await service.create({ name: "ci", projectId: project.id });

      expect(apiKeyRepository.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id }));
    });

    it("binds the key to the project of the key the request authenticated with when no project is requested", async () => {
      const project = createProject();
      const { service, apiKeyRepository, projectRepository } = setup({ project, currentApiKey: createApiKey({ projectId: project.id }) });

      await service.create({ name: "ci" });

      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ id: project.id, deletedAt: null });
      expect(apiKeyRepository.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id }));
    });

    it("rejects a project the active organization does not hold", async () => {
      const { service, apiKeyRepository } = setup({ project: undefined });

      await expect(service.create({ name: "ci", projectId: faker.string.uuid() })).rejects.toMatchObject({ status: 404, message: "Project not found" });
      expect(apiKeyRepository.create).not.toHaveBeenCalled();
    });

    it("rejects a project outside the request's project scope", async () => {
      const project = createProject();
      const { service, apiKeyRepository, projectRepository } = setup({
        project,
        organizationContext: createOrganizationContext({ projectScope: { kind: "projects", projectIds: [faker.string.uuid()] } })
      });

      await expect(service.create({ name: "ci", projectId: project.id })).rejects.toMatchObject({ status: 404 });
      expect(projectRepository.findOneBy).not.toHaveBeenCalled();
      expect(apiKeyRepository.create).not.toHaveBeenCalled();
    });

    it("rejects a project while organizations are off for the caller", async () => {
      const project = createProject();
      const { service, apiKeyRepository, projectRepository } = setup({ project, organizationsOn: false });

      await expect(service.create({ name: "ci", projectId: project.id })).rejects.toMatchObject({ status: 404 });
      expect(projectRepository.findOneBy).not.toHaveBeenCalled();
      expect(apiKeyRepository.create).not.toHaveBeenCalled();
    });

    it("rejects a project for a request without an organization context", async () => {
      const project = createProject();
      const { service, apiKeyRepository, featureFlagsService } = setup({ project, organizationContext: null });

      await expect(service.create({ name: "ci", projectId: project.id })).rejects.toMatchObject({ status: 404 });
      expect(featureFlagsService.isEnabled).not.toHaveBeenCalled();
      expect(apiKeyRepository.create).not.toHaveBeenCalled();
    });

    it("stores the requested expiry", async () => {
      const { service, apiKeyRepository } = setup();
      const expiresAt = faker.date.future();

      await service.create({ name: "ci", expiresAt });

      expect(apiKeyRepository.create).toHaveBeenCalledWith(expect.objectContaining({ expiresAt }));
    });
  });

  describe("update", () => {
    it("updates a key among the caller's keys", async () => {
      const { service, apiKeyRepository, ability, user } = setup();
      const key = createApiKey({ userId: user.id });
      apiKeyRepository.updateBy.mockResolvedValue(key as never);

      const result = await service.update(key.id, { name: "renamed" });

      expect(result).toEqual(key);
      expect(apiKeyRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(apiKeyRepository.updateBy).toHaveBeenCalledWith({ id: key.id, userId: user.id }, { name: "renamed", expiresAt: undefined }, { returning: true });
    });

    it("updates a key only among the keys bound to the project of the key the request authenticated with", async () => {
      const projectId = faker.string.uuid();
      const { service, apiKeyRepository, user } = setup({ currentApiKey: createApiKey({ projectId }) });
      const id = faker.string.uuid();
      apiKeyRepository.updateBy.mockResolvedValue(undefined);

      const result = await service.update(id, { name: "renamed" });

      expect(result).toBeUndefined();
      expect(apiKeyRepository.updateBy).toHaveBeenCalledWith({ id, userId: user.id, projectId }, expect.anything(), { returning: true });
    });
  });

  describe("delete", () => {
    it("deletes a key among the caller's keys", async () => {
      const { service, apiKeyRepository, ability, user } = setup();
      const id = faker.string.uuid();

      await service.delete(id);

      expect(apiKeyRepository.accessibleBy).toHaveBeenCalledWith(ability, "delete");
      expect(apiKeyRepository.deleteBy).toHaveBeenCalledWith({ id, userId: user.id }, { returning: true });
    });

    it("deletes a key only among the keys bound to the project of the key the request authenticated with", async () => {
      const projectId = faker.string.uuid();
      const { service, apiKeyRepository, user } = setup({ currentApiKey: createApiKey({ projectId }) });
      const id = faker.string.uuid();

      await service.delete(id);

      expect(apiKeyRepository.deleteBy).toHaveBeenCalledWith({ id, userId: user.id, projectId }, { returning: true });
    });
  });

  function setup(
    input: {
      currentApiKey?: ApiKeyOutput;
      project?: ProjectOutput;
      organizationContext?: OrganizationContext | null;
      organizationsOn?: boolean;
    } = {}
  ) {
    const user = createUser();
    const ability = createMongoAbility();
    const organizationContext = input.organizationContext === null ? undefined : (input.organizationContext ?? createOrganizationContext());
    const apiKeyRepository = mock<ApiKeyRepository>();
    apiKeyRepository.accessibleBy.mockReturnValue(apiKeyRepository);
    const projectRepository = mock<ProjectRepository>();
    projectRepository.accessibleBy.mockReturnValue(projectRepository);
    projectRepository.findOneBy.mockResolvedValue(input.project);
    const authService = mock<AuthService>({ currentUser: user, ability, currentApiKey: input.currentApiKey });
    const apiKeyGenerator = mock<ApiKeyGeneratorService>({
      generateApiKey: vi.fn().mockReturnValue("ac.sk.test.generated"),
      hashApiKeySha256: vi.fn().mockReturnValue("hashed-key"),
      obfuscateApiKey: vi.fn().mockReturnValue("obfuscated-key")
    });
    const executionContextService = mock<ExecutionContextService>({
      get: vi.fn().mockImplementation(key => (key === "ORGANIZATION_CONTEXT" ? organizationContext : undefined))
    });
    const featureFlagsService = mock<FeatureFlagsService>({ isEnabled: vi.fn().mockReturnValue(input.organizationsOn ?? true) });
    const service = new ApiKeyService(apiKeyRepository, projectRepository, authService, apiKeyGenerator, executionContextService, featureFlagsService);

    return { service, apiKeyRepository, projectRepository, featureFlagsService, ability: authService.ability, user, apiKeyGenerator };
  }
});
