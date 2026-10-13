import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { TxService } from "@src/core/services/tx/tx.service";
import type {
  DeploymentLocation,
  DeploymentSettingRepository,
  DeploymentSettingsOutput
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import type { AuthorizationMode, ProjectScope } from "@src/organization/types/organization-context";
import { DeploymentProjectService, PROJECT_REQUIRED_ERROR_CODE } from "./deployment-project.service";

import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(DeploymentProjectService.name, () => {
  describe("resolveFilingProject", () => {
    it("ignores the requested project outside organization mode", async () => {
      const { service, projectRepository } = setup({ mode: "legacy" });

      await expect(service.resolveFilingProject(faker.string.uuid())).resolves.toBeUndefined();

      expect(projectRepository.findOneBy).not.toHaveBeenCalled();
    });

    it("ignores the requested project for a request running in no organization", async () => {
      const { service, projectRepository } = setup({ withoutContext: true });

      await expect(service.resolveFilingProject(faker.string.uuid())).resolves.toBeUndefined();

      expect(projectRepository.findOneBy).not.toHaveBeenCalled();
    });

    it("files into the live project the request names", async () => {
      const { service, projectRepository, project } = setup();

      await expect(service.resolveFilingProject(project.id)).resolves.toBe(project.id);

      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ id: project.id, deletedAt: null });
    });

    it("refuses with 404 a requested project it cannot find", async () => {
      const { service, projectRepository } = setup();
      projectRepository.findOneBy.mockResolvedValue(undefined);

      await expect(service.resolveFilingProject(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Project not found" });
    });

    it("refuses with 404 a requested project outside the caller's scope", async () => {
      const { service, project } = setup({ scopedProjectIds: [faker.string.uuid()] });

      await expect(service.resolveFilingProject(project.id)).rejects.toMatchObject({ status: 404 });
    });

    it("files into the default project when the request names none", async () => {
      const { service, projectRepository, project } = setup();

      await expect(service.resolveFilingProject()).resolves.toBe(project.id);

      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ isDefault: true, deletedAt: null });
    });

    it("files into the one project the caller is held to when the request names none", async () => {
      const soleProjectId = faker.string.uuid();
      const { service, projectRepository, project } = setup({
        projectScope: createProjectsScope([soleProjectId]),
        scopedProjectIds: [soleProjectId]
      });
      projectRepository.findOneBy.mockResolvedValue({ ...project, id: soleProjectId });

      await expect(service.resolveFilingProject()).resolves.toBe(soleProjectId);

      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ id: soleProjectId, deletedAt: null });
    });

    it("files into the one project the caller may write to among the projects it reads", async () => {
      const [readOnlyProjectId, writableProjectId] = [faker.string.uuid(), faker.string.uuid()];
      const { service, projectRepository, project } = setup({
        projectScope: createProjectsScope([readOnlyProjectId, writableProjectId], { writableProjectIds: [writableProjectId] }),
        scopedProjectIds: [writableProjectId]
      });
      projectRepository.findOneBy.mockResolvedValue({ ...project, id: writableProjectId });

      await expect(service.resolveFilingProject()).resolves.toBe(writableProjectId);

      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ id: writableProjectId, deletedAt: null });
    });

    it("files into the default project for a caller reaching several projects", async () => {
      const { service, projectRepository, project } = setup({ projectScope: createProjectsScope([faker.string.uuid(), faker.string.uuid()]) });

      await expect(service.resolveFilingProject()).resolves.toBe(project.id);

      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ isDefault: true, deletedAt: null });
    });

    it("asks for a project when the one project the caller is held to is gone", async () => {
      const { service, projectRepository } = setup({ projectScope: createProjectsScope([faker.string.uuid()]) });
      projectRepository.findOneBy.mockResolvedValue(undefined);

      await expect(service.resolveFilingProject()).rejects.toMatchObject({ status: 400, errorCode: PROJECT_REQUIRED_ERROR_CODE });
    });

    it("asks for a project when the default project is outside the caller's scope", async () => {
      const { service } = setup({ scopedProjectIds: [faker.string.uuid()] });

      await expect(service.resolveFilingProject()).rejects.toMatchObject({
        status: 400,
        message: "Choose a project to deploy into",
        errorCode: PROJECT_REQUIRED_ERROR_CODE
      });
    });

    it("asks for a project when the organization has no live default project", async () => {
      const { service, projectRepository } = setup();
      projectRepository.findOneBy.mockResolvedValue(undefined);

      await expect(service.resolveFilingProject()).rejects.toMatchObject({ status: 400, errorCode: PROJECT_REQUIRED_ERROR_CODE });
    });
  });

  describe("holdFilingProject", () => {
    it("holds the live project it is given", async () => {
      const { service, projectRepository, project } = setup();

      await expect(service.holdFilingProject(project.id)).resolves.toBeUndefined();

      expect(projectRepository.findActiveAndLock).toHaveBeenCalledWith(project.id);
    });

    it("refuses with 404 a project deleted since it was resolved", async () => {
      const { service, projectRepository } = setup();
      projectRepository.findActiveAndLock.mockResolvedValue(undefined);

      await expect(service.holdFilingProject(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Project not found" });
    });
  });

  describe("move", () => {
    it("files the deployment into the target project and records the move in that project", async () => {
      const { service, scopedSettingRepository, organizationActivityService, deployment, target, context, user } = setup();

      await expect(service.move(deployment.dseq, target.id)).resolves.toEqual({ dseq: deployment.dseq, projectId: target.id });

      expect(scopedSettingRepository.updateById).toHaveBeenCalledWith(deployment.id, { projectId: target.id });
      expect(organizationActivityService.record).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        projectId: target.id,
        type: "deployment_moved",
        actorUserId: user.id,
        payload: { dseq: deployment.dseq, name: deployment.name, toProjectName: target.name }
      });
    });

    it("reads and writes the deployment under the caller's update rules, inside one transaction", async () => {
      const { service, deploymentSettingRepository, scopedSettingRepository, projectRepository, txService, ability, deployment, target } = setup();

      await service.move(deployment.dseq, target.id);

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(ability, "update");
      expect(scopedSettingRepository.find).toHaveBeenCalledWith({ dseq: deployment.dseq });
      expect(projectRepository.findActiveAndLock).toHaveBeenCalledWith(target.id);
      expect(txService.transaction.mock.invocationCallOrder[0]).toBeLessThan(scopedSettingRepository.find.mock.invocationCallOrder[0]);
    });

    it("moves the caller's own deployment when another one of the organization shares its dseq", async () => {
      const { service, scopedSettingRepository, deployment, target, user } = setup();
      const own = mock<DeploymentSettingsOutput>({ id: faker.string.uuid(), userId: user.id, dseq: deployment.dseq, projectId: faker.string.uuid() });
      scopedSettingRepository.find.mockResolvedValue([deployment, own]);

      await service.move(deployment.dseq, target.id);

      expect(scopedSettingRepository.updateById).toHaveBeenCalledWith(own.id, { projectId: target.id });
    });

    it("changes nothing and records nothing for a deployment already in the target project", async () => {
      const { service, scopedSettingRepository, organizationActivityService, deployment, target } = setup();
      scopedSettingRepository.find.mockResolvedValue([{ ...deployment, projectId: target.id }]);

      await expect(service.move(deployment.dseq, target.id)).resolves.toEqual({ dseq: deployment.dseq, projectId: target.id });

      expect(scopedSettingRepository.updateById).not.toHaveBeenCalled();
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it.each<OrganizationRole>(["member", "viewer", "billing"])("refuses a %s with 403 before reading anything", async role => {
      const { service, txService, deployment, target } = setup({ role });

      await expect(service.move(deployment.dseq, target.id)).rejects.toMatchObject({
        status: 403,
        message: "Only owners and admins can move deployments between projects"
      });

      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("refuses with 403 outside organization mode", async () => {
      const { service, txService, deployment, target } = setup({ mode: "legacy" });

      await expect(service.move(deployment.dseq, target.id)).rejects.toMatchObject({
        status: 403,
        message: "Deployments are filed into projects of an organization and this request runs in none"
      });

      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("refuses with 404 a deployment outside the caller's reach", async () => {
      const { service, scopedSettingRepository, target } = setup();
      scopedSettingRepository.find.mockResolvedValue([]);

      await expect(service.move(faker.string.numeric(8), target.id)).rejects.toMatchObject({ status: 404, message: "Deployment not found" });

      expect(scopedSettingRepository.updateById).not.toHaveBeenCalled();
    });

    it("refuses with 404 a target project that is deleted or belongs to another organization", async () => {
      const { service, scopedSettingRepository, projectRepository, organizationActivityService, deployment } = setup();
      projectRepository.findActiveAndLock.mockResolvedValue(undefined);

      await expect(service.move(deployment.dseq, faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Project not found" });

      expect(scopedSettingRepository.updateById).not.toHaveBeenCalled();
      expect(organizationActivityService.record).not.toHaveBeenCalled();
    });

    it("refuses with 404 a target project outside the caller's scope", async () => {
      const { service, scopedSettingRepository, deployment, target } = setup({ role: "admin", scopedProjectIds: [faker.string.uuid()] });

      await expect(service.move(deployment.dseq, target.id)).rejects.toMatchObject({ status: 404, message: "Project not found" });

      expect(scopedSettingRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("findLocation", () => {
    it("locates the deployment among the caller's organizations", async () => {
      const { service, deploymentSettingRepository, user } = setup();
      const location = { organizationId: faker.string.uuid(), organizationSlug: faker.lorem.slug(), projectId: faker.string.uuid() };
      deploymentSettingRepository.findLocation.mockResolvedValue(location);

      await expect(service.findLocation("1234", { acrossOrganizations: true })).resolves.toEqual(location);

      expect(deploymentSettingRepository.findLocation).toHaveBeenCalledWith({ userId: user.id, dseq: "1234", within: undefined });
    });

    it("holds a lookup that may not cross organizations to the active organization", async () => {
      const { service, deploymentSettingRepository, context } = setup();
      deploymentSettingRepository.findLocation.mockResolvedValue(mock<DeploymentLocation>());

      await service.findLocation("1234", { acrossOrganizations: false });

      expect(deploymentSettingRepository.findLocation).toHaveBeenCalledWith(
        expect.objectContaining({ within: { organizationId: context.organizationId, projectIds: undefined } })
      );
    });

    it("holds a lookup that may not cross organizations to the projects the request is narrowed to", async () => {
      const projectIds = [faker.string.uuid()];
      const { service, deploymentSettingRepository, context } = setup({ projectScope: createProjectsScope(projectIds) });
      deploymentSettingRepository.findLocation.mockResolvedValue(mock<DeploymentLocation>());

      await service.findLocation("1234", { acrossOrganizations: false });

      expect(deploymentSettingRepository.findLocation).toHaveBeenCalledWith(
        expect.objectContaining({ within: { organizationId: context.organizationId, projectIds } })
      );
    });

    it("refuses with 404 a deployment in none of the caller's organizations", async () => {
      const { service, deploymentSettingRepository } = setup();
      deploymentSettingRepository.findLocation.mockResolvedValue(undefined);

      await expect(service.findLocation("1234", { acrossOrganizations: true })).rejects.toMatchObject({ status: 404, message: "Deployment not found" });
    });
  });

  function setup(input?: {
    mode?: AuthorizationMode;
    role?: OrganizationRole;
    scopedProjectIds?: string[];
    projectScope?: ProjectScope;
    withoutContext?: boolean;
  }) {
    const user = createUser();
    const context = createOrganizationContext({ role: input?.role ?? "owner", mode: input?.mode ?? "organization", projectScope: input?.projectScope });
    const projectConditions = input?.scopedProjectIds ? { projectId: { $in: input.scopedProjectIds } } : {};
    const ability = createMongoAbility<MongoAbility>([
      { action: "create", subject: "DeploymentSetting", conditions: { organizationId: context.organizationId, ...projectConditions } }
    ]);
    const project = mock<ProjectOutput>({ id: faker.string.uuid(), organizationId: context.organizationId, name: faker.word.noun() });
    const target = mock<ProjectOutput>({ id: faker.string.uuid(), organizationId: context.organizationId, name: faker.word.noun() });
    const deployment = mock<DeploymentSettingsOutput>({
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      dseq: faker.string.numeric(8),
      projectId: project.id,
      name: faker.word.noun()
    });

    const projectRepository = mock<ProjectRepository>();
    projectRepository.findOneBy.mockResolvedValue(project);
    projectRepository.findActiveAndLock.mockResolvedValue(target);
    const scopedSettingRepository = mock<DeploymentSettingRepository>();
    scopedSettingRepository.find.mockResolvedValue([deployment]);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.accessibleBy.mockReturnValue(scopedSettingRepository);
    const organizationActivityService = mock<OrganizationActivityService>();
    const authService = mock<AuthService>({ currentUser: user });
    authService.ability = ability;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.hasContext.mockReturnValue(!input?.withoutContext);
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(context);
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());

    const service = new DeploymentProjectService(
      projectRepository,
      deploymentSettingRepository,
      organizationActivityService,
      authService,
      executionContextService,
      txService
    );

    return {
      service,
      projectRepository,
      deploymentSettingRepository,
      scopedSettingRepository,
      organizationActivityService,
      txService,
      ability,
      context,
      user,
      project,
      target,
      deployment
    };
  }
});
