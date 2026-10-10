import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import { DeploymentOrganizationActivityService } from "./deployment-organization-activity.service";

describe(DeploymentOrganizationActivityService.name, () => {
  describe("recordCreated", () => {
    it("files the creation into the deployment's organization and project, credited to its owner", async () => {
      const { service, organizationActivityService, deployment, key } = setup();

      await service.recordCreated(key);

      expect(organizationActivityService.recordForDeployment).toHaveBeenCalledWith({
        organizationId: deployment.organizationId,
        projectId: deployment.projectId,
        type: "deployment_created",
        actorUserId: key.userId,
        payload: { dseq: key.dseq, name: deployment.name }
      });
    });

    it("reads the deployment by its owner and dseq, whatever organization the caller runs in", async () => {
      const { service, deploymentSettingRepository, unscopedRepository, key } = setup();

      await service.recordCreated(key);

      expect(deploymentSettingRepository.unscoped).toHaveBeenCalledWith("deployment-activity");
      expect(unscopedRepository.findOneBy).toHaveBeenCalledWith(key);
    });

    it("files nothing for a deployment the console holds no row for", async () => {
      const { service, organizationActivityService, logger, key } = setup({ deployment: null });

      await service.recordCreated(key);

      expect(organizationActivityService.recordForDeployment).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("files nothing for a deployment not yet filed into an organization", async () => {
      const { service, organizationActivityService, key } = setup({ organizationId: null });

      await service.recordCreated(key);

      expect(organizationActivityService.recordForDeployment).not.toHaveBeenCalled();
    });

    it("logs a failure to file the creation rather than raising it", async () => {
      const { service, organizationActivityService, logger, key } = setup();
      const error = new Error("database unavailable");
      organizationActivityService.recordForDeployment.mockRejectedValue(error);

      await expect(service.recordCreated(key)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ event: "DEPLOYMENT_ORGANIZATION_ACTIVITY_RECORD_FAILED", ...key, type: "deployment_created", error });
    });
  });

  describe("recordClosed", () => {
    it("files the close into the deployment's organization and project, with who closed it and why", async () => {
      const { service, organizationActivityService, deployment, key } = setup();

      await service.recordClosed(key, { actorUserId: null, reason: "runtime_limit_reached" });

      expect(organizationActivityService.recordForDeployment).toHaveBeenCalledWith({
        organizationId: deployment.organizationId,
        projectId: deployment.projectId,
        type: "deployment_closed",
        actorUserId: null,
        payload: { dseq: key.dseq, name: deployment.name, reason: "runtime_limit_reached" }
      });
    });

    it("logs a failure to read the deployment rather than raising it", async () => {
      const { service, unscopedRepository, organizationActivityService, logger, key } = setup();
      const error = new Error("database unavailable");
      unscopedRepository.findOneBy.mockRejectedValue(error);

      await expect(service.recordClosed(key, { actorUserId: key.userId, reason: null })).resolves.toBeUndefined();

      expect(organizationActivityService.recordForDeployment).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith({ event: "DEPLOYMENT_ORGANIZATION_ACTIVITY_RECORD_FAILED", ...key, type: "deployment_closed", error });
    });
  });

  it("creates its logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: DeploymentOrganizationActivityService.name });
  });

  function setup(input?: { deployment?: null; organizationId?: null }) {
    const key = { userId: faker.string.uuid(), dseq: faker.string.numeric(8) };
    const deployment = mock<DeploymentSettingsOutput>({
      ...key,
      organizationId: input?.organizationId === null ? null : faker.string.uuid(),
      projectId: faker.string.uuid(),
      name: faker.word.noun()
    });
    const unscopedRepository = mock<DeploymentSettingRepository>();
    unscopedRepository.findOneBy.mockResolvedValue(input?.deployment === null ? undefined : deployment);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.unscoped.mockReturnValue(unscopedRepository);
    const organizationActivityService = mock<OrganizationActivityService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new DeploymentOrganizationActivityService(deploymentSettingRepository, organizationActivityService, createLogger);

    return { service, deploymentSettingRepository, unscopedRepository, organizationActivityService, logger, createLogger, deployment, key };
  }
});
