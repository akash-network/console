import { faker } from "@faker-js/faker";
import { hoursToMilliseconds, minutesToMilliseconds } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { CreateLogger, JobPayload } from "@src/core";
import type { CloseExpiredDeploymentCommand } from "@src/deployment/commands/close-expired-deployment.command";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentCloseJobService } from "@src/deployment/services/deployment-close-job/deployment-close-job.service";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { CloseExpiredDeploymentHandler } from "./close-expired-deployment.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(CloseExpiredDeploymentHandler.name, () => {
  it("runs one close per deployment at a time so a reconciled duplicate cannot broadcast twice", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("singleton");
  });

  it("closes the deployment on chain and marks the setting closed", async () => {
    const setting = createSetting();
    const address = createAkashAddress();
    const { handler, deploymentWriterService, deploymentSettingRepository } = setup({ setting, address });

    await handler.handle(createPayload(setting));

    expect(deploymentWriterService.close).toHaveBeenCalledWith(expect.objectContaining({ address }), setting.dseq);
    expect(deploymentSettingRepository.updateById).toHaveBeenCalledWith(setting.id, { closed: true });
  });

  it("does nothing when the setting no longer exists", async () => {
    const setting = createSetting();
    const { handler, deploymentWriterService, deploymentCloseJobService } = setup({ setting: undefined });

    await handler.handle(createPayload(setting));

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(deploymentCloseJobService.schedule).not.toHaveBeenCalled();
  });

  it("does nothing when the deployment is already marked closed", async () => {
    const setting = createSetting({ closed: true });
    const { handler, deploymentWriterService, deploymentCloseJobService } = setup({ setting });

    await handler.handle(createPayload(setting));

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(deploymentCloseJobService.schedule).not.toHaveBeenCalled();
  });

  it("does nothing when the runtime limit has since been removed", async () => {
    const setting = createSetting({ runtimeEndsAt: null });
    const { handler, deploymentWriterService, deploymentCloseJobService } = setup({ setting });

    await handler.handle(createPayload(setting));

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(deploymentCloseJobService.schedule).not.toHaveBeenCalled();
  });

  it("reschedules itself without closing when the deadline has since moved forward", async () => {
    const runtimeEndsAt = hoursFromNow(5);
    const setting = createSetting({ runtimeEndsAt });
    const { handler, deploymentWriterService, deploymentCloseJobService } = setup({ setting });

    await handler.handle(createPayload(setting));

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(deploymentCloseJobService.schedule).toHaveBeenCalledWith(
      { deploymentSettingId: setting.id, userId: setting.userId, dseq: setting.dseq },
      { startAfter: runtimeEndsAt, withCleanup: true }
    );
  });

  it("retries later without closing when the owner wallet is not initialized", async () => {
    const setting = createSetting();
    const { handler, deploymentWriterService, deploymentCloseJobService } = setup({ setting, address: null });

    await handler.handle(createPayload(setting));

    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expectRetriedLater(deploymentCloseJobService, setting);
  });

  it("retries later without closing when the escrow cannot be settled yet", async () => {
    const setting = createSetting();
    const { handler, deploymentSettingRepository, deploymentCloseJobService } = setup({
      setting,
      closeError: new Error("escrow not settled"),
      isUnsettleable: true
    });

    await handler.handle(createPayload(setting));

    expect(deploymentSettingRepository.updateById).not.toHaveBeenCalled();
    expectRetriedLater(deploymentCloseJobService, setting);
  });

  it("rethrows a close failure the chain does not explain, leaving the queue to retry it", async () => {
    const setting = createSetting();
    const closeError = new Error("broadcast failed");
    const { handler, deploymentSettingRepository, deploymentCloseJobService } = setup({ setting, closeError });

    await expect(handler.handle(createPayload(setting))).rejects.toThrow(closeError);

    expect(deploymentSettingRepository.updateById).not.toHaveBeenCalled();
    expect(deploymentCloseJobService.schedule).not.toHaveBeenCalled();
  });

  describe("when the dry run flag is on", () => {
    it("logs the close it would have made and retries later instead of broadcasting", async () => {
      const setting = createSetting();
      const address = createAkashAddress();
      const { handler, deploymentWriterService, deploymentSettingRepository, deploymentCloseJobService, logger } = setup({
        setting,
        address,
        dryRun: true
      });

      await handler.handle(createPayload(setting));

      expect(deploymentWriterService.close).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.updateById).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "EXPIRED_DEPLOYMENT_WOULD_CLOSE", dseq: setting.dseq, owner: address }));
      expectRetriedLater(deploymentCloseJobService, setting);
    });
  });

  function expectRetriedLater(deploymentCloseJobService: ReturnType<typeof setup>["deploymentCloseJobService"], setting: DeploymentSettingsOutput) {
    expect(deploymentCloseJobService.schedule).toHaveBeenCalledWith(
      { deploymentSettingId: setting.id, userId: setting.userId, dseq: setting.dseq },
      { startAfter: expect.any(Date), withCleanup: true }
    );

    const [, options] = deploymentCloseJobService.schedule.mock.calls[0];
    expect(options.startAfter.getTime()).toBeGreaterThan(Date.now() + minutesToMilliseconds(14));
  }

  function hoursFromNow(hours: number) {
    return new Date(Date.now() + hoursToMilliseconds(hours));
  }

  function createSetting(overrides: Partial<DeploymentSettingsOutput> = {}) {
    return Object.assign(mock<DeploymentSettingsOutput>(), {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      dseq: faker.string.numeric(6),
      closed: false,
      runtimeEndsAt: new Date(Date.now() - hoursToMilliseconds(1)),
      ...overrides
    });
  }

  function createPayload(setting: DeploymentSettingsOutput): JobPayload<CloseExpiredDeploymentCommand> {
    return { deploymentSettingId: setting.id, userId: setting.userId, dseq: setting.dseq, version: 1 };
  }

  function setup(
    input: {
      setting?: DeploymentSettingsOutput;
      address?: string | null;
      closeError?: Error;
      isUnsettleable?: boolean;
      dryRun?: boolean;
    } = {}
  ) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentWriterService = mock<DeploymentWriterService>();
    const deploymentCloseJobService = mock<DeploymentCloseJobService>();
    const chainErrorService = mock<ChainErrorService>();
    const deploymentConfig = mockConfigService<DeploymentConfigService>({
      CLOSE_EXPIRED_DEPLOYMENTS_DRY_RUN: input.dryRun ? "true" : "false"
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    deploymentSettingRepository.findOneBy.mockResolvedValue(input.setting);
    userWalletRepository.findOneByUserId.mockResolvedValue(
      createUserWallet({ address: input.address === null ? null : input.address ?? createAkashAddress() })
    );
    chainErrorService.isUnsettleableDeploymentError.mockReturnValue(input.isUnsettleable ?? false);

    if (input.closeError) {
      deploymentWriterService.close.mockRejectedValue(input.closeError);
    }

    const handler = new CloseExpiredDeploymentHandler(
      deploymentSettingRepository,
      userWalletRepository,
      deploymentWriterService,
      deploymentCloseJobService,
      chainErrorService,
      deploymentConfig,
      createLogger
    );

    return {
      handler,
      deploymentSettingRepository,
      userWalletRepository,
      deploymentWriterService,
      deploymentCloseJobService,
      chainErrorService,
      deploymentConfig,
      logger,
      createLogger
    };
  }
});
