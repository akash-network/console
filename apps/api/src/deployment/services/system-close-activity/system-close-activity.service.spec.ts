import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { CreateLogger } from "@src/core";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { systemClosedActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { SystemCloseActivityService } from "./system-close-activity.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(SystemCloseActivityService.name, () => {
  it("records the close in the feed of the member a team deployment was filed under", async () => {
    const { service, activityService, teamWallet } = setup({ filedUnder: "member-1" });

    await service.record({ wallet: teamWallet, dseq: "100", reason: "runtime_limit_reached" });

    expect(activityService.record).toHaveBeenCalledWith(
      systemClosedActivityOf({ userId: "member-1", owner: teamWallet.address, dseq: "100", reason: "runtime_limit_reached" })
    );
  });

  it("looks the deployment up past the active organization, for the wallet that owns it", async () => {
    const { service, deploymentSettingRepository, teamWallet } = setup({ filedUnder: "member-1" });

    await service.record({ wallet: teamWallet, dseq: "100", reason: "no_lease" });

    expect(deploymentSettingRepository.unscoped).toHaveBeenCalledWith("deployment-activity");
    expect(deploymentSettingRepository.findOneOwnedByWallet).toHaveBeenCalledWith(teamWallet, "100");
  });

  it("records the close in a personal wallet's user's feed when Console holds no record of the deployment", async () => {
    const { service, activityService, personalWallet } = setup({ filedUnder: undefined });

    await service.record({ wallet: personalWallet, dseq: "100", reason: "trial_ended" });

    expect(activityService.record).toHaveBeenCalledWith(
      systemClosedActivityOf({ userId: personalWallet.userId, owner: personalWallet.address, dseq: "100", reason: "trial_ended" })
    );
  });

  it.each([
    { case: "has no record of the deployment", filedUnder: undefined },
    { case: "holds a record whose member deleted their account", filedUnder: null }
  ])("records nothing and says so for a team deployment Console $case", async ({ filedUnder }) => {
    const { service, activityService, logger, teamWallet } = setup({ filedUnder });

    await expect(service.record({ wallet: teamWallet, dseq: "100", reason: "provider_unreachable" })).resolves.toBeUndefined();

    expect(activityService.record).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith({
      event: "SYSTEM_CLOSE_ACTIVITY_SKIPPED",
      reason: "NO_DEPLOYMENT_USER",
      owner: teamWallet.address,
      organizationId: teamWallet.organizationId,
      dseq: "100",
      closeReason: "provider_unreachable"
    });
  });

  it("logs a failed lookup instead of failing the close that already happened", async () => {
    const { service, activityService, deploymentSettingRepository, logger, teamWallet } = setup({ filedUnder: "member-1" });
    const error = new Error("connection terminated");
    deploymentSettingRepository.findOneOwnedByWallet.mockRejectedValue(error);

    await expect(service.record({ wallet: teamWallet, dseq: "100", reason: "no_lease" })).resolves.toBeUndefined();

    expect(activityService.record).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({
      event: "SYSTEM_CLOSE_ACTIVITY_RECORD_FAILED",
      owner: teamWallet.address,
      organizationId: teamWallet.organizationId,
      dseq: "100",
      closeReason: "no_lease",
      error
    });
  });

  it("creates its logger with its own context", () => {
    const { createLogger } = setup({ filedUnder: undefined });

    expect(createLogger).toHaveBeenCalledWith({ context: SystemCloseActivityService.name });
  });

  function setup(input: { filedUnder: string | null | undefined }) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.unscoped.mockReturnValue(deploymentSettingRepository);
    deploymentSettingRepository.findOneOwnedByWallet.mockResolvedValue(
      input.filedUnder === undefined ? undefined : mock<DeploymentSettingsOutput>({ userId: input.filedUnder })
    );
    const activityService = mock<ActivityService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new SystemCloseActivityService(deploymentSettingRepository, activityService, createLogger);

    return {
      service,
      deploymentSettingRepository,
      activityService,
      logger,
      createLogger,
      teamWallet: { userId: null, organizationId: faker.string.uuid(), address: createAkashAddress() },
      personalWallet: { userId: faker.string.uuid(), organizationId: faker.string.uuid(), address: createAkashAddress() }
    };
  }
});
