import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { RecordDeploymentSettingHandler, recordDeploymentSettingKeyFor } from "./record-deployment-setting.handler";

const DSEQ = "1748400000000";

describe(RecordDeploymentSettingHandler.name, () => {
  it("records the deployment it is given", async () => {
    const { handler, payload, deploymentSettingRepository } = setup({});

    await handler.handle(payload);

    expect(deploymentSettingRepository.createDefaultIfMissing).toHaveBeenCalledWith(expect.objectContaining({ userId: payload.userId, dseq: DSEQ }));
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

  function setup(input: { wasMissing?: boolean; writeRejectsWith?: unknown }) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.createDefaultIfMissing.mockImplementation(async () => {
      if (input.writeRejectsWith) throw input.writeRejectsWith;
      return input.wasMissing ?? true;
    });

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new RecordDeploymentSettingHandler(deploymentSettingRepository, createLogger);

    return {
      handler,
      payload: { userId: faker.string.uuid(), dseq: DSEQ, version: 1 as const },
      deploymentSettingRepository,
      logger,
      createLogger
    };
  }
});
