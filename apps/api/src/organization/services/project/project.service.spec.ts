import { faker } from "@faker-js/faker";
import { PostgresError } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { ProjectRepository, ProjectWithCreator } from "@src/organization/repositories/project/project.repository";
import type { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { ProjectService } from "./project.service";

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
    it("files the project into the active organization under the slug of its name and records it in the same transaction", async () => {
      const { service, projectRepository, organizationActivityService, txService, ability, user, context } = setup();
      const created = createProject({ organizationId: context.organizationId, name: "Checkout API", slug: "checkout-api" });
      projectRepository.create.mockResolvedValue(created);
      txService.transaction.mockImplementation(async callback => {
        const result = await callback();
        expect(organizationActivityService.record).toHaveBeenCalled();
        return result;
      });

      const project = await service.create({ name: "Checkout API", description: "Storefront" });

      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "create");
      expect(projectRepository.create).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        name: "Checkout API",
        slug: "checkout-api",
        description: "Storefront",
        createdByUserId: user.id
      });
      expect(organizationActivityService.record).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        type: "project_created",
        actorUserId: user.id,
        projectId: created.id,
        payload: { projectName: "Checkout API" }
      });
      expect(project).toEqual({ ...created, createdBy: { id: user.id, username: user.username } });
    });

    it.each([undefined, ""])("stores a project created with the description %j as having none", async description => {
      const { service, projectRepository } = setup();

      await service.create({ name: "web", description });

      expect(projectRepository.create).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });

    it("names no username for a creator who has none", async () => {
      const { service } = setup({ username: null });

      const project = await service.create({ name: "web" });

      expect(project.createdBy).toEqual({ id: expect.any(String), username: null });
    });

    it("refuses a name another project of the organization already has", async () => {
      const { service, projectRepository, organizationActivityService } = setup();
      projectRepository.create.mockRejectedValue(createSlugTakenError());

      await expect(service.create({ name: "web" })).rejects.toMatchObject({ status: 409, errorCode: "project_name_taken" });
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it("passes on any other failure to write the project", async () => {
      const { service, projectRepository } = setup();
      const failure = new Error("connection reset");
      projectRepository.create.mockRejectedValue(failure);

      await expect(service.create({ name: "web" })).rejects.toBe(failure);
    });

    it("refuses a request that runs in no organization", async () => {
      const { service, projectRepository } = setup({ context: null });

      await expect(service.create({ name: "web" })).rejects.toMatchObject({ status: 403 });
      expect(projectRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("renames an active project and its slug, then returns it as the caller reads it", async () => {
      const { service, projectRepository, ability, project } = setup();

      const updated = await service.update(project.id, { name: "Checkout API" });

      expect(projectRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(projectRepository.updateBy).toHaveBeenCalledWith(
        { id: project.id, deletedAt: null },
        { name: "Checkout API", slug: "checkout-api" },
        { returning: true }
      );
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

    it("refuses a new name another project of the organization already has", async () => {
      const { service, projectRepository, project } = setup();
      projectRepository.updateBy.mockRejectedValue(createSlugTakenError());

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
      expect(deploymentSettingRepository.count).toHaveBeenCalledWith({ projectId: project.id, closed: false });
      expect(projectRepository.updateById).toHaveBeenCalledWith(project.id, { deletedAt: expect.any(Date) });
    });

    it("answers not found when no active project with this id is within the caller's rules", async () => {
      const { service, projectRepository } = setup();
      projectRepository.findOneByAndLock.mockResolvedValue(undefined);

      await expect(service.delete(faker.string.uuid())).rejects.toMatchObject({ status: 404 });
      expect(projectRepository.updateById).not.toHaveBeenCalled();
    });

    it("refuses to delete the default project", async () => {
      const { service, projectRepository, deploymentSettingRepository, project } = setup();
      projectRepository.findOneByAndLock.mockResolvedValue({ ...project, isDefault: true });

      await expect(service.delete(project.id)).rejects.toMatchObject({ status: 409, errorCode: "project_is_default" });
      expect(deploymentSettingRepository.count).not.toHaveBeenCalled();
      expect(projectRepository.updateById).not.toHaveBeenCalled();
    });

    it("refuses to delete a project that still holds an open deployment", async () => {
      const { service, projectRepository, deploymentSettingRepository, project } = setup();
      deploymentSettingRepository.count.mockResolvedValue(1);

      await expect(service.delete(project.id)).rejects.toMatchObject({ status: 409, errorCode: "project_not_empty" });
      expect(projectRepository.updateById).not.toHaveBeenCalled();
    });
  });

  function createSlugTakenError() {
    const driverError = Object.assign(Object.create(PostgresError.prototype), {
      name: "PostgresError",
      code: "23505",
      constraint_name: "projects_organization_id_slug_unique",
      message: 'duplicate key value violates unique constraint "projects_organization_id_slug_unique"'
    });

    return new Error("Failed query: insert into projects", { cause: driverError });
  }

  function setup(input: { context?: OrganizationContext | null; username?: string | null } = {}) {
    const user = createUser({ username: input.username === undefined ? faker.internet.userName() : input.username });
    const context = input.context === undefined ? createOrganizationContext() : input.context;
    const ability = mock<AuthService["ability"]>();
    const project: ProjectWithCreator = { ...createProject({ organizationId: context?.organizationId }), createdBy: { id: user.id, username: user.username } };
    const projectRepository = mock<ProjectRepository>({
      findActiveWithCreator: vi.fn().mockResolvedValue([project]),
      create: vi.fn().mockResolvedValue(project),
      updateBy: vi.fn().mockResolvedValue(project),
      findOneByAndLock: vi.fn().mockResolvedValue(project)
    });
    projectRepository.accessibleBy.mockReturnValue(projectRepository);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({ count: vi.fn().mockResolvedValue(0) });
    const organizationActivityService = mock<OrganizationActivityService>();
    const authService = mock<AuthService>({ ability, currentUser: user });
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.mockImplementation(((key: string) =>
      key === "ORGANIZATION_CONTEXT" ? context ?? undefined : undefined) as ExecutionContextService["get"]);
    const txService = mock<TxService>({ transaction: vi.fn(callback => callback()) });

    const service = new ProjectService(
      projectRepository,
      deploymentSettingRepository,
      organizationActivityService,
      authService,
      executionContextService,
      txService
    );

    return { service, projectRepository, deploymentSettingRepository, organizationActivityService, txService, ability, user, context: context!, project };
  }
});
