import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentPresenceService } from "@src/deployment/services/deployment-presence/deployment-presence.service";
import {
  DeleteUnbackedDeploymentSetting,
  DeleteUnbackedDeploymentSettingHandler,
  unbackedDeploymentSettingKeyFor
} from "./delete-unbacked-deployment-setting.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const OWNER = createAkashAddress();
const DSEQ = "1748400000000";

describe(DeleteUnbackedDeploymentSettingHandler.name, () => {
  it("deletes the setting when the chain does not have the deployment", async () => {
    const { handler, payload, deploymentSettingRepository } = setup({ isOnChain: false });

    await handler.handle(payload);

    expect(deploymentSettingRepository.deleteById).toHaveBeenCalledWith(payload.deploymentSettingId);
  });

  it("keeps the setting when the chain does have the deployment", async () => {
    const { handler, payload, deploymentSettingRepository } = setup({ isOnChain: true });

    await handler.handle(payload);

    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
  });

  it("keeps the setting and lets a node that could not be reached surface, so the queue retries", async () => {
    const unreachable = new SDKError("[unknown] fetch failed", SDKErrorCode.Unknown);
    const { handler, payload, deploymentSettingRepository } = setup({ chainLookupRejectsWith: unreachable });

    await expect(handler.handle(payload)).rejects.toThrow(unreachable);

    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
  });

  it("keeps the setting and lets an unrecognised failure surface, so the queue retries", async () => {
    const { handler, payload, deploymentSettingRepository } = setup({ chainLookupRejectsWith: new Error("Deployment not found") });

    await expect(handler.handle(payload)).rejects.toThrow("Deployment not found");

    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
  });

  it("names the setting it could not check, so a compensation that exhausts its retries is traceable", async () => {
    const { handler, payload, logger } = setup({ chainLookupRejectsWith: new Error("fetch failed") });

    await expect(handler.handle(payload)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "UNBACKED_DEPLOYMENT_SETTING_CHAIN_LOOKUP_FAILED",
        deploymentSettingId: payload.deploymentSettingId,
        owner: OWNER,
        dseq: DSEQ
      })
    );
  });

  it("does nothing when the setting is already gone, so a repeated delivery is harmless", async () => {
    const { handler, payload, deploymentSettingRepository, deploymentPresenceService } = setup({ settingExists: false });

    await handler.handle(payload);

    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
    expect(deploymentPresenceService.isOnChain).not.toHaveBeenCalled();
  });

  it("keeps a setting whose stored dseq is not the one the chain was asked about", async () => {
    const { handler, payload, deploymentSettingRepository, deploymentPresenceService } = setup({ isOnChain: false, storedDseq: "1748400000001" });

    await handler.handle(payload);

    expect(deploymentSettingRepository.deleteById).not.toHaveBeenCalled();
    expect(deploymentPresenceService.isOnChain).not.toHaveBeenCalled();
  });

  it("asks the chain about the deployment the payload names", async () => {
    const { handler, payload, deploymentPresenceService } = setup({ isOnChain: true });

    await handler.handle(payload);

    expect(deploymentPresenceService.isOnChain).toHaveBeenCalledWith({ owner: OWNER, dseq: DSEQ });
  });

  it("accepts the job the create enqueues", () => {
    const { handler } = setup({ isOnChain: true });

    expect(handler.accepts).toBe(DeleteUnbackedDeploymentSetting);
  });

  it("keys a compensation by the setting's owner and dseq", () => {
    expect(unbackedDeploymentSettingKeyFor({ userId: "user-1", dseq: DSEQ })).toBe(`deleteUnbackedDeploymentSetting.user-1.${DSEQ}`);
  });

  it("creates the logger with the handler context", () => {
    const { createLogger } = setup({ isOnChain: true });

    expect(createLogger).toHaveBeenCalledWith({ context: DeleteUnbackedDeploymentSettingHandler.name });
  });

  function setup(input: { isOnChain?: boolean; chainLookupRejectsWith?: unknown; settingExists?: boolean; storedDseq?: string }) {
    const deploymentSettingId = faker.string.uuid();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findById.mockResolvedValue(
      input.settingExists === false ? undefined : mock<DeploymentSettingsOutput>({ id: deploymentSettingId, dseq: input.storedDseq ?? DSEQ })
    );

    const deploymentPresenceService = mock<DeploymentPresenceService>();
    deploymentPresenceService.isOnChain.mockImplementation(async () => {
      if (input.chainLookupRejectsWith) throw input.chainLookupRejectsWith;
      return input.isOnChain ?? true;
    });

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new DeleteUnbackedDeploymentSettingHandler(deploymentSettingRepository, deploymentPresenceService, createLogger);

    return {
      handler,
      payload: { deploymentSettingId, owner: OWNER, dseq: DSEQ, version: 1 as const },
      deploymentSettingRepository,
      deploymentPresenceService,
      logger,
      createLogger
    };
  }
});
