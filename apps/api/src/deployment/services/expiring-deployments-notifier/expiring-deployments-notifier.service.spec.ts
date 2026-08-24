import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/core";
import type { DeploymentSettingRepository, ExpiringRuntimeDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { runtimeLimitEndingNotification } from "@src/notifications/services/notification-templates/runtime-limit-ending-notification";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { ExpiringDeploymentsNotifierService } from "./expiring-deployments-notifier.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(ExpiringDeploymentsNotifierService.name, () => {
  it("claims the deadline and emails the owner a link to the deployment settings tab", async () => {
    const expiring = createExpiringRuntimeDeployment();
    const { service, deploymentSettingRepository, notificationService, users } = setup({ expiring });

    const result = await service.notifyExpiringDeployments({ dryRun: false });

    expect(deploymentSettingRepository.claimRuntimeEndingNotification).toHaveBeenCalledWith(expiring.id, expiring.runtimeEndsAt);
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      runtimeLimitEndingNotification(users[expiring.userId], {
        dseq: expiring.dseq,
        owner: expiring.address,
        runtimeEndsAt: expiring.runtimeEndsAt.toISOString(),
        deploymentSettingsUrl: `https://console.example.com/deployments/${expiring.dseq}?tab=SETTINGS`
      })
    );
    expect(result.ok).toBe(true);
  });

  it("queries with the configured lead time and minimum limit", async () => {
    const { service, deploymentSettingRepository } = setup({ expiring: [] });

    await service.notifyExpiringDeployments({ dryRun: false });

    expect(deploymentSettingRepository.findExpiringRuntimeDeployments).toHaveBeenCalledWith({ leadHours: 6, minLimitHours: 12 });
  });

  it("neither claims nor emails on a dry run", async () => {
    const { service, deploymentSettingRepository, notificationService } = setup({ expiring: createExpiringRuntimeDeployment() });

    const result = await service.notifyExpiringDeployments({ dryRun: true });

    expect(deploymentSettingRepository.claimRuntimeEndingNotification).not.toHaveBeenCalled();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("sends nothing when another pass already claimed the deadline", async () => {
    const { service, notificationService } = setup({ expiring: createExpiringRuntimeDeployment(), claimed: false });

    const result = await service.notifyExpiringDeployments({ dryRun: false });

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("skips a deployment whose owner has no email without claiming the deadline", async () => {
    const expiring = createExpiringRuntimeDeployment();
    const { service, deploymentSettingRepository, notificationService } = setup({ expiring, userEmail: null });

    const result = await service.notifyExpiringDeployments({ dryRun: false });

    expect(deploymentSettingRepository.claimRuntimeEndingNotification).not.toHaveBeenCalled();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("keeps notifying the rest of the sweep when one deployment fails, and reports the failure", async () => {
    const failing = createExpiringRuntimeDeployment();
    const succeeding = createExpiringRuntimeDeployment();
    const { service, notificationService } = setup({
      expiring: [failing, succeeding],
      notificationError: { dseq: failing.dseq, error: new Error("notifications api down") }
    });

    const result = await service.notifyExpiringDeployments({ dryRun: false });

    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(result.err).toBe(true);
  });

  function createExpiringRuntimeDeployment(overrides: Partial<ExpiringRuntimeDeployment> = {}): ExpiringRuntimeDeployment {
    return {
      id: faker.string.uuid(),
      dseq: faker.string.numeric(6),
      userId: faker.string.uuid(),
      walletId: faker.number.int({ min: 1, max: 10000 }),
      address: createAkashAddress(),
      runtimeLimitHours: 24,
      runtimeEndsAt: faker.date.soon({ days: 1 }),
      ...overrides
    };
  }

  function setup(input: {
    expiring: ExpiringRuntimeDeployment | ExpiringRuntimeDeployment[];
    claimed?: boolean;
    userEmail?: string | null;
    notificationError?: { dseq: string; error: Error };
  }) {
    const expiring = Array.isArray(input.expiring) ? input.expiring : [input.expiring];
    const users = Object.fromEntries(
      expiring.map(deployment => [
        deployment.userId,
        createUser({ id: deployment.userId, email: input.userEmail === undefined ? faker.internet.email() : input.userEmail })
      ])
    ) as Record<string, UserOutput>;

    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const userRepository = mock<UserRepository>();
    const notificationService = mock<NotificationService>();
    const config = mockConfigService<DeploymentConfigService>({
      RUNTIME_LIMIT_WARNING_LEAD_IN_H: 6,
      RUNTIME_LIMIT_WARNING_MIN_LIMIT_IN_H: 12,
      DEPLOY_WEB_BASE_URL: "https://console.example.com"
    });
    const logger = mock<LoggerService>();

    deploymentSettingRepository.findExpiringRuntimeDeployments.mockResolvedValue(expiring);
    deploymentSettingRepository.claimRuntimeEndingNotification.mockResolvedValue(input.claimed ?? true);
    userRepository.findById.mockImplementation(async userId => users[userId]);

    if (input.notificationError) {
      const failingDseq = input.notificationError.dseq;
      notificationService.createNotification.mockImplementation(async notification => {
        if (notification.payload.description.includes(failingDseq)) {
          throw input.notificationError!.error;
        }
      });
    }

    const service = new ExpiringDeploymentsNotifierService(deploymentSettingRepository, userRepository, notificationService, config, logger);

    return { service, deploymentSettingRepository, userRepository, notificationService, config, logger, expiring, users };
  }
});
