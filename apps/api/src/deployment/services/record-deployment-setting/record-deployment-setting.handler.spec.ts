import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, TxService } from "@src/core";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { RecordDeploymentSettingHandler, recordDeploymentSettingKeyFor } from "./record-deployment-setting.handler";

const DSEQ = "1748400000000";

describe(RecordDeploymentSettingHandler.name, () => {
  it("records the deployment it is given", async () => {
    const { handler, payload, deploymentSettingRepository } = setup({});

    await handler.handle(payload);

    expect(deploymentSettingRepository.createDefaultIfMissing).toHaveBeenCalledWith(expect.objectContaining({ userId: payload.userId, dseq: DSEQ }));
  });

  it("files the deployment into the project it names while that is a live project of its organization, inside one transaction", async () => {
    const organizationId = faker.string.uuid();
    const project = mock<ProjectOutput>({ id: faker.string.uuid(), organizationId });
    const { handler, payload, deploymentSettingRepository, projectRepository, txService } = setup({ project });

    await handler.handle({ ...payload, organizationId, projectId: project.id });

    expect(projectRepository.findActiveAndLock).toHaveBeenCalledWith(project.id);
    expect(deploymentSettingRepository.createDefaultIfMissing).toHaveBeenCalledWith(expect.objectContaining({ organizationId, projectId: project.id }));
    expect(txService.transaction.mock.invocationCallOrder[0]).toBeLessThan(projectRepository.findActiveAndLock.mock.invocationCallOrder[0]);
  });

  it("drops a named project that is deleted or gone, so the row falls back to the default project", async () => {
    const { handler, payload, deploymentSettingRepository } = setup({ project: undefined });

    await handler.handle({ ...payload, organizationId: faker.string.uuid(), projectId: faker.string.uuid() });

    expect(deploymentSettingRepository.createDefaultIfMissing).toHaveBeenCalledWith(expect.objectContaining({ projectId: undefined }));
  });

  it("drops a named project of another organization", async () => {
    const project = mock<ProjectOutput>({ id: faker.string.uuid(), organizationId: faker.string.uuid() });
    const { handler, payload, deploymentSettingRepository } = setup({ project });

    await handler.handle({ ...payload, organizationId: faker.string.uuid(), projectId: project.id });

    expect(deploymentSettingRepository.createDefaultIfMissing).toHaveBeenCalledWith(expect.objectContaining({ projectId: undefined }));
  });

  it("reads no project for a payload that names none", async () => {
    const { handler, payload, projectRepository } = setup({});

    await handler.handle(payload);

    expect(projectRepository.findActiveAndLock).not.toHaveBeenCalled();
  });

  it("reports the deployment it recorded", async () => {
    const { handler, payload, logger } = setup({ wasMissing: true });

    await handler.handle(payload);

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_SETTING_RECORDED", userId: payload.userId, dseq: DSEQ }));
  });

  it("reports a deployment another path had already recorded", async () => {
    const { handler, payload, logger } = setup({ wasMissing: false });

    await handler.handle(payload);

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_SETTING_ALREADY_RECORDED", userId: payload.userId, dseq: DSEQ }));
  });

  it("lets a failed write surface, so the queue retries rather than losing the record", async () => {
    const { handler, payload } = setup({ writeRejectsWith: new Error("connection terminated") });

    await expect(handler.handle(payload)).rejects.toThrow("connection terminated");
  });

  it("keys a record by the owning user and the dseq", () => {
    expect(recordDeploymentSettingKeyFor({ userId: "user-1", dseq: DSEQ })).toBe(`recordDeploymentSetting.user-1.${DSEQ}`);
  });

  it("creates the logger with the handler context", () => {
    const { createLogger } = setup({});

    expect(createLogger).toHaveBeenCalledWith({ context: RecordDeploymentSettingHandler.name });
  });

  it("declares the exclusive policy, so a retried broadcast of the same create enqueues one job across queued, retrying and running", () => {
    const { handler } = setup({});

    expect(handler.policy).toBe("exclusive");
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup({});

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: { wasMissing?: boolean; writeRejectsWith?: unknown; project?: ProjectOutput }) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.createDefaultIfMissing.mockImplementation(async () => {
      if (input.writeRejectsWith) throw input.writeRejectsWith;
      return input.wasMissing ?? true;
    });
    const projectRepository = mock<ProjectRepository>();
    projectRepository.findActiveAndLock.mockResolvedValue(input.project);
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new RecordDeploymentSettingHandler(deploymentSettingRepository, projectRepository, txService, createLogger);

    return {
      handler,
      payload: { userId: faker.string.uuid(), dseq: DSEQ, version: 1 as const },
      deploymentSettingRepository,
      projectRepository,
      txService,
      logger,
      createLogger
    };
  }
});
