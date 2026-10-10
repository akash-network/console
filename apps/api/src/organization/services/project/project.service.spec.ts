import { faker } from "@faker-js/faker";
import { PostgresError } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { DeploymentSettingRepository, OpenDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { MAX_NUMBERED_SLUG_SUFFIX } from "@src/organization/lib/slug/slug";
import { PROJECT_NAME_UNIQUE_INDEX } from "@src/organization/model-schemas/project/project.schema";
import type { ProjectRepository, ProjectWithCreator } from "@src/organization/repositories/project/project.repository";
import type { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { ProjectService } from "./project.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createProject } from "@test/seeders/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(ProjectService.name, () => {
  describe("list", () => {
    it("lists the active projects the caller may read", async () => {
      const { service, projectRepository, ability, project } = setup();

      const projects = await service.list();

      expect(projects).toEqual([project]);
      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectRepository.findActiveWithCreator).toHaveBeenCalledWith();
    });
  });

  describe("get", () => {
    it("returns the active project with this id the caller may read", async () => {
      const { service, projectRepository, ability, project } = setup();

      const found = await service.get(project.id);

      expect(found).toEqual(project);
      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
      expect(projectRepository.findActiveWithCreator).toHaveBeenCalledWith({ id: project.id });
    });

    it("answers not found when the caller may read no such project", async () => {
      const { service, projectRepository } = setup();
      projectRepository.findActiveWithCreator.mockResolvedValue([]);

      await expect(service.get(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("create", () => {
    it("files the project into the active organization under the first free slug of its name and records it in the same transaction", async () => {
      const { service, projectRepository, organizationActivityService, txService, ability, user, context } = setup();
      const created = createProject({ organizationId: context.organizationId, name: "Checkout API", slug: "checkout-api" });
      projectRepository.createWithFirstFreeSlug.mockResolvedValue(created);
      txService.transaction.mockImplementation(async callback => {
        const result = await callback();
        expect(organizationActivityService.record).toHaveBeenCalled();
        return result;
      });

      const project = await service.create({ name: "Checkout API", description: "Storefront" });

      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "create");
      expect(projectRepository.createWithFirstFreeSlug).toHaveBeenCalledWith(
        { organizationId: context.organizationId, name: "Checkout API", description: "Storefront", createdByUserId: user.id },
        expect.any(Array)
      );
      expect(slugsTried(projectRepository).slice(0, 2)).toEqual(["checkout-api", "checkout-api-2"]);
      expect(slugsTried(projectRepository)).toHaveLength(MAX_NUMBERED_SLUG_SUFFIX + 1);
      expect(organizationActivityService.record).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        type: "project_created",
        actorUserId: user.id,
        projectId: created.id,
        payload: { projectName: "Checkout API" }
      });
      expect(project).toEqual({ ...created, createdBy: { id: user.id, username: user.username } });
    });

    it("gives a name without a latin letter or digit a generated slug", async () => {
      const { service, projectRepository } = setup();

      await service.create({ name: "プロジェクト" });

      expect(slugsTried(projectRepository)[0]).toMatch(/^project-[0-9a-f]{8}$/);
    });

    it.each([undefined, ""])("stores a project created with the description %j as having none", async description => {
      const { service, projectRepository } = setup();

      await service.create({ name: "web", description });

      expect(projectRepository.createWithFirstFreeSlug).toHaveBeenCalledWith(expect.objectContaining({ description: null }), expect.any(Array));
    });

    it("names no username for a creator who has none", async () => {
      const { service } = setup({ username: null });

      const project = await service.create({ name: "web" });

      expect(project.createdBy).toEqual({ id: expect.any(String), username: null });
    });

    it("refuses a name another live project of the organization already has", async () => {
      const { service, projectRepository, organizationActivityService } = setup();
      projectRepository.createWithFirstFreeSlug.mockRejectedValue(createUniqueViolation(PROJECT_NAME_UNIQUE_INDEX));

      await expect(service.create({ name: "web" })).rejects.toMatchObject({ status: 409, errorCode: "project_name_taken" });
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it("passes on any other failure to write the project", async () => {
      const { service, projectRepository } = setup();
      const failure = createUniqueViolation("projects_organization_id_id_unique");
      projectRepository.createWithFirstFreeSlug.mockRejectedValue(failure);

      await expect(service.create({ name: "web" })).rejects.toBe(failure);
    });

    it("fails without recording anything when every slug candidate is taken", async () => {
      const { service, projectRepository, organizationActivityService } = setup();
      projectRepository.createWithFirstFreeSlug.mockResolvedValue(undefined);

      await expect(service.create({ name: "web" })).rejects.toThrow("Every slug candidate for the project is taken");
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it("refuses a request that runs in no organization", async () => {
      const { service, projectRepository } = setup({ context: null });

      await expect(service.create({ name: "web" })).rejects.toMatchObject({ status: 403 });
      expect(projectRepository.createWithFirstFreeSlug).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("renames an active project without touching its slug, then returns it as the caller reads it", async () => {
      const { service, projectRepository, ability, project } = setup();

      const updated = await service.update(project.id, { name: "Checkout API" });

      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(projectRepository.updateBy).toHaveBeenCalledWith({ id: project.id, deletedAt: null }, { name: "Checkout API" }, { returning: true });
      expect(projectRepository.findActiveWithCreator).toHaveBeenCalledWith({ id: project.id });
      expect(updated).toEqual(project);
    });

    it("changes only the description when the request names no new name", async () => {
      const { service, projectRepository, project } = setup();

      await service.update(project.id, { description: "Storefront" });

      expect(projectRepository.updateBy).toHaveBeenCalledWith(expect.anything(), { description: "Storefront" }, { returning: true });
    });

    it.each([null, ""])("clears the description when the request sets it to %j", async description => {
      const { service, projectRepository, project } = setup();

      await service.update(project.id, { description });

      expect(projectRepository.updateBy).toHaveBeenCalledWith(expect.anything(), { description: null }, { returning: true });
    });

    it("answers not found when no active project with this id is within the caller's rules", async () => {
      const { service, projectRepository } = setup();
      projectRepository.updateBy.mockResolvedValue(undefined);

      await expect(service.update(faker.string.uuid(), { name: "web" })).rejects.toMatchObject({ status: 404 });
    });

    it("refuses a new name another live project of the organization already has", async () => {
      const { service, projectRepository, project } = setup();
      projectRepository.updateBy.mockRejectedValue(createUniqueViolation(PROJECT_NAME_UNIQUE_INDEX));

      await expect(service.update(project.id, { name: "web" })).rejects.toMatchObject({ status: 409, errorCode: "project_name_taken" });
    });
  });

  describe("delete", () => {
    it("marks a project holding no open deployment deleted, inside the transaction that locked it", async () => {
      const { service, projectRepository, deploymentSettingRepository, txService, ability, project } = setup();
      txService.transaction.mockImplementation(async callback => {
        const result = await callback();
        expect(projectRepository.updateById).toHaveBeenCalled();
        return result;
      });

      await service.delete(project.id);

      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "delete");
      expect(projectRepository.findOneByAndLock).toHaveBeenCalledWith({ id: project.id, deletedAt: null });
      expect(deploymentSettingRepository.findOpenByProjectId).toHaveBeenCalledWith(project.id);
      expect(deploymentSettingRepository.count).toHaveBeenCalledWith({ projectId: project.id, closed: false });
      expect(projectRepository.updateById).toHaveBeenCalledWith(project.id, { deletedAt: expect.any(Date) });
    });

    it("closes the deployments the chain reports closed before deciding the project is empty", async () => {
      const paddedDseq = createOpenDeployment({ dseq: "000123" });
      const unpadded = createOpenDeployment();
      const { service, projectRepository, deploymentSettingRepository, deploymentRepository, project } = setup({ openDeployments: [paddedDseq, unpadded] });
      deploymentRepository.findClosureStates.mockResolvedValue([
        { owner: paddedDseq.address, dseq: "123", isClosed: true },
        { owner: unpadded.address, dseq: unpadded.dseq, isClosed: true }
      ]);

      await service.delete(project.id);

      expect(deploymentRepository.findClosureStates).toHaveBeenCalledWith([
        { owner: paddedDseq.address, dseq: "123" },
        { owner: unpadded.address, dseq: unpadded.dseq }
      ]);
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([paddedDseq.id, unpadded.id]);
      expect(projectRepository.updateById).toHaveBeenCalled();
    });

    it("refuses while a deployment is still open on chain and keeps the ones it found closed", async () => {
      const closedOnChain = createOpenDeployment();
      const openOnChain = createOpenDeployment();
      const unindexed = createOpenDeployment();
      const { service, projectRepository, deploymentSettingRepository, deploymentRepository, txService, project } = setup({
        openDeployments: [closedOnChain, openOnChain, unindexed]
      });
      deploymentRepository.findClosureStates.mockResolvedValue([
        { owner: closedOnChain.address, dseq: closedOnChain.dseq, isClosed: true },
        { owner: openOnChain.address, dseq: openOnChain.dseq, isClosed: false }
      ]);
      deploymentSettingRepository.count.mockResolvedValue(2);
      const committed = vi.fn();
      txService.transaction.mockImplementation(async callback => {
        const result = await callback();
        committed();
        return result;
      });

      await expect(service.delete(project.id)).rejects.toMatchObject({ status: 409, errorCode: "project_not_empty" });
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([closedOnChain.id]);
      expect(committed).toHaveBeenCalled();
      expect(projectRepository.updateById).not.toHaveBeenCalled();
    });

    it("answers not found when no active project with this id is within the caller's rules", async () => {
      const { service, projectRepository, deploymentSettingRepository } = setup();
      projectRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expect(service.delete(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(deploymentSettingRepository.findOpenByProjectId).not.toHaveBeenCalled();
      expect(projectRepository.updateById).not.toHaveBeenCalled();
    });

    it("refuses to delete the default project", async () => {
      const { service, projectRepository, deploymentSettingRepository, project } = setup();
      projectRepository.findOneByAndLock.mockResolvedValue({ ...project, isDefault: true });

      await expect(service.delete(project.id)).rejects.toMatchObject({ status: 409, errorCode: "project_is_default" });
      expect(deploymentSettingRepository.findOpenByProjectId).not.toHaveBeenCalled();
      expect(projectRepository.updateById).not.toHaveBeenCalled();
    });
  });

  function slugsTried(projectRepository: ReturnType<typeof setup>["projectRepository"]) {
    return projectRepository.createWithFirstFreeSlug.mock.calls[0][1];
  }

  function createOpenDeployment(overrides: Partial<OpenDeployment> = {}): OpenDeployment {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      dseq: faker.string.numeric({ length: 7, allowLeadingZeros: false }),
      address: createAkashAddress(),
      createdAt: faker.date.recent(),
      ...overrides
    };
  }

  function createUniqueViolation(constraintName: string) {
    const driverError = Object.assign(Object.create(PostgresError.prototype), {
      name: "PostgresError",
      code: "23505",
      constraint_name: constraintName,
      message: `duplicate key value violates unique constraint "${constraintName}"`
    });

    return new Error("Failed query: insert into projects", { cause: driverError });
  }

  function setup(input: { context?: OrganizationContext | null; username?: string | null; openDeployments?: OpenDeployment[] } = {}) {
    const user = createUser({ username: input.username === undefined ? faker.internet.userName() : input.username });
    const context = input.context === undefined ? createOrganizationContext() : input.context;
    const ability = mock<AuthService["ability"]>();
    const project: ProjectWithCreator = { ...createProject({ organizationId: context?.organizationId }), createdBy: { id: user.id, username: user.username } };
    const projectRepository = mock<ProjectRepository>({
      findActiveWithCreator: vi.fn().mockResolvedValue([project]),
      createWithFirstFreeSlug: vi.fn().mockResolvedValue(project),
      updateBy: vi.fn().mockResolvedValue(project),
      findOneByAndLock: vi.fn().mockResolvedValue(project)
    });
    projectRepository.accessibleBy.mockReturnValue(projectRepository);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({
      findOpenByProjectId: vi.fn().mockResolvedValue(input.openDeployments ?? []),
      count: vi.fn().mockResolvedValue(0)
    });
    const deploymentRepository = mock<DeploymentRepository>({ findClosureStates: vi.fn().mockResolvedValue([]) });
    const organizationActivityService = mock<OrganizationActivityService>();
    const authService = mock<AuthService>({ ability, currentUser: user });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.mockImplementation(((key: string) =>
      key === "ORGANIZATION_CONTEXT" ? context ?? undefined : undefined) as ExecutionContextService["get"]);
    const txService = mock<TxService>({ transaction: vi.fn(callback => callback()) });

    const service = new ProjectService(
      projectRepository,
      deploymentSettingRepository,
      deploymentRepository,
      organizationActivityService,
      authService,
      executionContextService,
      txService
    );

    return {
      service,
      projectRepository,
      deploymentSettingRepository,
      deploymentRepository,
      organizationActivityService,
      txService,
      ability,
      user,
      context: context!,
      project
    };
  }
});
