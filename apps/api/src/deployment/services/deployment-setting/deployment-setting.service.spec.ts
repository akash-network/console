import "@test/mocks/logger-service.mock";

import { ForbiddenError } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
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
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(DeploymentSettingService.name, () => {
  describe("findOrCreateByUserIdAndDseq", () => {
    it("returns existing setting when found", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toEqual(expect.objectContaining({ userId: params.userId, dseq: params.dseq }));
      expect(deploymentSettingRepository.create).not.toHaveBeenCalled();
    });

    it("creates a row carrying no auto top-up decision when none exists", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput(params));
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      await service.findOrCreateByUserIdAndDseq(params);

      expect(deploymentSettingRepository.create).toHaveBeenCalledWith({ userId: params.userId, dseq: params.dseq });
    });

    it("defaults auto top-up to enabled on an existing row the user never configured when they have a managed wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: null }));
      userWalletRepository.findOneByUserId.mockResolvedValue(createUserWallet({ userId: params.userId }));
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: true, estimatedTopUpAmount: 500000 }));
      expect(deploymentSettingRepository.create).not.toHaveBeenCalled();
    });

    it("defaults auto top-up to enabled when no row exists yet and the user has a managed wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: null }));
      userWalletRepository.findOneByUserId.mockResolvedValue(createUserWallet({ userId: params.userId }));
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: true }));
    });

    it("defaults auto top-up to disabled when the user has no managed wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: null }));
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: false, estimatedTopUpAmount: 0 }));
    });

    it("defaults auto top-up to disabled when the managed wallet has no address yet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: null }));
      userWalletRepository.findOneByUserId.mockResolvedValue(createUserWallet({ userId: params.userId, address: null }));

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: false, estimatedTopUpAmount: 0 }));
    });

    it("leaves auto top-up off for a user who explicitly disabled it despite having a managed wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: false }));
      userWalletRepository.findOneByUserId.mockResolvedValue(createUserWallet({ userId: params.userId }));

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: false, estimatedTopUpAmount: 0 }));
      expect(userWalletRepository.findOneByUserId).not.toHaveBeenCalled();
    });

    it("leaves auto top-up on for a user who explicitly enabled it without consulting the wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true }));
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: true }));
      expect(userWalletRepository.findOneByUserId).not.toHaveBeenCalled();
    });

    it("schedules no wallet reload when it creates the row", async () => {
      const { service, deploymentSettingRepository, userWalletRepository, walletReloadJobService, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: null }));
      userWalletRepository.findOneByUserId.mockResolvedValue(createUserWallet({ userId: params.userId }));
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      await service.findOrCreateByUserIdAndDseq(params);

      expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
    });

    it("returns undefined on ForbiddenError", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      const forbiddenError = Object.create(ForbiddenError.prototype);
      deploymentSettingRepository.create.mockRejectedValue(forbiddenError);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(result).toBeUndefined();
    });
  });

  describe("createUnconfigured", () => {
    it("creates the row without an auto top-up decision", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: null }));
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      await service.createUnconfigured(params);

      expect(deploymentSettingRepository.create).toHaveBeenCalledWith({ userId: params.userId, dseq: params.dseq });
    });

    it("schedules no wallet reload even when the user has a managed wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository, walletReloadJobService, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: null }));
      userWalletRepository.findOneByUserId.mockResolvedValue(createUserWallet({ userId: params.userId }));
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      const result = await service.createUnconfigured(params);

      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: true }));
      expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("schedules an immediate wallet reload when auto top-up is explicitly enabled", async () => {
      const { service, deploymentSettingRepository, walletReloadJobService, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true }));
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      await service.create({ ...params, autoTopUpEnabled: true });

      expect(walletReloadJobService.scheduleImmediate).toHaveBeenCalledWith({ userId: params.userId });
    });

    it("schedules no wallet reload when auto top-up is explicitly disabled", async () => {
      const { service, deploymentSettingRepository, walletReloadJobService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: false }));

      await service.create({ ...params, autoTopUpEnabled: false });

      expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
    });
  });

  describe("upsert", () => {
    it("records setting toggle when autoTopUpEnabled changes", async () => {
      const { service, deploymentSettingRepository, instrumentation, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: false });
      const updated = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);
      deploymentSettingRepository.updateBy.mockResolvedValue(updated as never);
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      await service.upsert(params, { autoTopUpEnabled: true });

      expect(instrumentation.recordSettingToggle).toHaveBeenCalledWith(true);
    });

    it("does not record setting toggle when autoTopUpEnabled stays the same", async () => {
      const { service, deploymentSettingRepository, instrumentation, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });
      const updated = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);
      deploymentSettingRepository.updateBy.mockResolvedValue(updated as never);
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      await service.upsert(params, { autoTopUpEnabled: true });

      expect(instrumentation.recordSettingToggle).not.toHaveBeenCalled();
    });

    it("does not record setting toggle when disabling an unconfigured setting that already resolved to disabled", async () => {
      const { service, deploymentSettingRepository, instrumentation, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: null });
      const updated = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: false });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);
      deploymentSettingRepository.updateBy.mockResolvedValue(updated as never);
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      await service.upsert(params, { autoTopUpEnabled: false });

      expect(instrumentation.recordSettingToggle).not.toHaveBeenCalled();
    });

    it("records setting toggle when enabling an unconfigured setting of a user without a wallet", async () => {
      const { service, deploymentSettingRepository, instrumentation, userWalletRepository, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: null });
      const updated = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);
      deploymentSettingRepository.updateBy.mockResolvedValue(updated as never);
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      await service.upsert(params, { autoTopUpEnabled: true });

      expect(instrumentation.recordSettingToggle).toHaveBeenCalledWith(true);
    });

    it("records setting toggle when creating new setting", async () => {
      const { service, deploymentSettingRepository, instrumentation, drainingDeploymentService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const created = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.updateBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(created);
      drainingDeploymentService.calculateTopUpAmountForDseqAndUserId.mockResolvedValue(500000);

      await service.upsert(params, { autoTopUpEnabled: true });

      expect(instrumentation.recordSettingToggle).toHaveBeenCalledWith(true);
    });
  });

  function createDeploymentSettingsOutput(overrides: Partial<DeploymentSettingsOutput> = {}): DeploymentSettingsOutput {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      dseq: faker.string.numeric(6),
      autoTopUpEnabled: null,
      closed: false,
      lastFundedAt: null,
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
