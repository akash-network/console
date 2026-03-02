import "@test/mocks/logger-service.mock";

import { ForbiddenError } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import type { DrainingDeploymentService } from "../draining-deployment/draining-deployment.service";
import type { TopUpManagedDeploymentsInstrumentationService } from "../top-up-managed-deployments/top-up-managed-deployments-instrumentation.service";
import { DeploymentSettingService } from "./deployment-setting.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(DeploymentSettingService.name, () => {
  describe("findOrCreateByUserIdAndDseq", () => {
    it("returns existing setting when found", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput(params);

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toEqual(expect.objectContaining({ userId: params.userId, dseq: params.dseq }));
      expect(userWalletRepository.findOneByUserId).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.create).not.toHaveBeenCalled();
    });

    it("creates with autoTopUpEnabled true when user has managed wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const userWallet = UserWalletSeeder.create({ userId: params.userId });
      const created = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(created);
      userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(params.userId);
      expect(deploymentSettingRepository.create).toHaveBeenCalledWith(expect.objectContaining({ autoTopUpEnabled: true }));
      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: true }));
    });

    it("creates with autoTopUpEnabled false when user has no managed wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const created = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: false });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(created);
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(params.userId);
      expect(deploymentSettingRepository.create).toHaveBeenCalledWith(expect.objectContaining({ autoTopUpEnabled: false }));
      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: false }));
    });

    it("returns undefined on ForbiddenError", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);
      const forbiddenError = Object.create(ForbiddenError.prototype);
      deploymentSettingRepository.create.mockRejectedValue(forbiddenError);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toBeUndefined();
    });
  });

  function createDeploymentSettingsOutput(overrides: Partial<DeploymentSettingsOutput> = {}): DeploymentSettingsOutput {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      dseq: faker.string.numeric(6),
      autoTopUpEnabled: false,
      closed: false,
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.past().toISOString(),
      ...overrides
    };
  }

  function setup() {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const authService = mock<AuthService>();
    const drainingDeploymentService = mock<DrainingDeploymentService>();
    const walletReloadJobService = mock<WalletReloadJobService>();
    const userWalletRepository = mock<UserWalletRepository>();
    const instrumentation = mock<TopUpManagedDeploymentsInstrumentationService>();

    const config = mockConfigService<DeploymentConfigService>({
      AUTO_TOP_UP_LOOK_AHEAD_WINDOW_IN_H: 24
    });

    const service = new DeploymentSettingService(
      deploymentSettingRepository,
      authService,
      drainingDeploymentService,
      walletReloadJobService,
      config,
      userWalletRepository,
      instrumentation
    );

    return {
      service,
      deploymentSettingRepository,
      authService,
      drainingDeploymentService,
      walletReloadJobService,
      config,
      userWalletRepository,
      instrumentation
    };
  }
});
