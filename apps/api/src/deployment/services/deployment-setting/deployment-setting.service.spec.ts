import "@test/mocks/logger-service.mock";

import { ForbiddenError } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
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
      const userWallet = createUserWallet({ userId: params.userId });
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

  describe("upsert", () => {
    it("records setting toggle when autoTopUpEnabled changes", async () => {
      const { service, deploymentSettingRepository, instrumentation } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: false });
      const updated = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);
      deploymentSettingRepository.updateBy.mockResolvedValue(updated as never);

      await service.upsert(params, { autoTopUpEnabled: true });

      expect(instrumentation.recordSettingToggle).toHaveBeenCalledWith(true);
    });

    it("does not record setting toggle when autoTopUpEnabled stays the same", async () => {
      const { service, deploymentSettingRepository, instrumentation } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });
      const updated = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);
      deploymentSettingRepository.updateBy.mockResolvedValue(updated as never);

      await service.upsert(params, { autoTopUpEnabled: true });

      expect(instrumentation.recordSettingToggle).not.toHaveBeenCalled();
    });

    it("records setting toggle when creating new setting", async () => {
      const { service, deploymentSettingRepository, instrumentation } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const created = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.updateBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(created);

      await service.upsert(params, { autoTopUpEnabled: true });

      expect(instrumentation.recordSettingToggle).toHaveBeenCalledWith(true);
    });
  });

  describe("upsert with a runtime limit", () => {
    it("sets a first limit on an unlimited deployment", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput({ ...params, runtimeLimitHours: null });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);
      deploymentSettingRepository.applyRuntimeLimit.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));

      const result = await service.upsert(params, { runtimeLimitHours: 12 });

      expect(deploymentSettingRepository.applyRuntimeLimit).toHaveBeenCalledWith({ ...params, runtimeLimitHours: 12, maxIncrementHours: 48 });
      expect(result).toEqual(expect.objectContaining({ runtimeLimitHours: 12 }));
    });

    it("extends an existing limit", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const existing = createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(existing);
      deploymentSettingRepository.applyRuntimeLimit.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 60 }));

      const result = await service.upsert(params, { runtimeLimitHours: 60 });

      expect(deploymentSettingRepository.applyRuntimeLimit).toHaveBeenCalledWith({ ...params, runtimeLimitHours: 60, maxIncrementHours: 48 });
      expect(result).toEqual(expect.objectContaining({ runtimeLimitHours: 60 }));
    });

    it("rejects a first limit above the increment cap", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: null }));

      await expect(service.upsert(params, { runtimeLimitHours: 49 })).rejects.toMatchObject({ status: 400 });
      expect(deploymentSettingRepository.applyRuntimeLimit).not.toHaveBeenCalled();
    });

    it("rejects a decrease", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 24 }));

      await expect(service.upsert(params, { runtimeLimitHours: 12 })).rejects.toMatchObject({ status: 400 });
      expect(deploymentSettingRepository.applyRuntimeLimit).not.toHaveBeenCalled();
    });

    it("rejects an unchanged limit", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 24 }));

      await expect(service.upsert(params, { runtimeLimitHours: 24 })).rejects.toMatchObject({ status: 400 });
      expect(deploymentSettingRepository.applyRuntimeLimit).not.toHaveBeenCalled();
    });

    it("rejects an extension larger than the increment cap", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 24 }));

      await expect(service.upsert(params, { runtimeLimitHours: 73 })).rejects.toMatchObject({ status: 400 });
      expect(deploymentSettingRepository.applyRuntimeLimit).not.toHaveBeenCalled();
    });

    it("rejects a limit change on a closed deployment", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12, closed: true }));

      await expect(service.upsert(params, { runtimeLimitHours: 24 })).rejects.toMatchObject({ status: 400 });
      expect(deploymentSettingRepository.applyRuntimeLimit).not.toHaveBeenCalled();
    });

    it("creates a limited row with auto top-up on when no setting exists yet", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12, autoTopUpEnabled: true }));

      await service.upsert(params, { runtimeLimitHours: 12 });

      expect(deploymentSettingRepository.create).toHaveBeenCalledWith({ ...params, runtimeLimitHours: 12, autoTopUpEnabled: true });
      expect(deploymentSettingRepository.applyRuntimeLimit).not.toHaveBeenCalled();
    });

    it("keeps an explicit autoTopUpEnabled when creating a limited row", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12, autoTopUpEnabled: false }));

      await service.upsert(params, { runtimeLimitHours: 12, autoTopUpEnabled: false });

      expect(deploymentSettingRepository.create).toHaveBeenCalledWith({ ...params, runtimeLimitHours: 12, autoTopUpEnabled: false });
    });

    it("returns 409 when the guarded update finds no eligible row", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));
      deploymentSettingRepository.applyRuntimeLimit.mockResolvedValue(undefined);

      await expect(service.upsert(params, { runtimeLimitHours: 24 })).rejects.toMatchObject({ status: 409 });
    });

    it("leaves the runtime limit untouched for an autoTopUpEnabled-only update", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));
      deploymentSettingRepository.updateBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }) as never);

      await service.upsert(params, { autoTopUpEnabled: false });

      expect(deploymentSettingRepository.applyRuntimeLimit).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.updateBy).toHaveBeenCalledWith(params, { autoTopUpEnabled: false }, { returning: true });
    });
  });

  describe("funding an extended runtime limit", () => {
    it("publishes a funding command when the extended deployment is already anchored", async () => {
      const { service, deploymentSettingRepository, userWalletRepository, domainEvents } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const wallet = createUserWallet({ userId: params.userId });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));
      deploymentSettingRepository.applyRuntimeLimit.mockResolvedValue(
        createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 24, runtimeEndsAt: faker.date.future() })
      );
      userWalletRepository.findOneByUserId.mockResolvedValue(wallet);

      await service.upsert(params, { runtimeLimitHours: 24 });

      expect(domainEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ data: { walletId: wallet.id, address: wallet.address, dseq: params.dseq } }),
        { singletonKey: `${FundDeploymentCommand.name}.${params.dseq}.${wallet.id}` }
      );
    });

    it("does not publish a funding command for an unanchored deployment", async () => {
      const { service, deploymentSettingRepository, domainEvents } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));
      deploymentSettingRepository.applyRuntimeLimit.mockResolvedValue(
        createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 24, runtimeEndsAt: null })
      );

      await service.upsert(params, { runtimeLimitHours: 24 });

      expect(domainEvents.publish).not.toHaveBeenCalled();
    });

    it("does not publish a funding command when creating a limited setting", async () => {
      const { service, deploymentSettingRepository, domainEvents } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));

      await service.upsert(params, { runtimeLimitHours: 12 });

      expect(domainEvents.publish).not.toHaveBeenCalled();
    });

    it("does not publish a funding command for an autoTopUpEnabled-only update", async () => {
      const { service, deploymentSettingRepository, domainEvents } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(
        createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12, runtimeEndsAt: faker.date.future() })
      );
      deploymentSettingRepository.updateBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }) as never);

      await service.upsert(params, { autoTopUpEnabled: true });

      expect(domainEvents.publish).not.toHaveBeenCalled();
    });

    it("skips the funding command when the user has no wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository, domainEvents } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));
      deploymentSettingRepository.applyRuntimeLimit.mockResolvedValue(
        createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 24, runtimeEndsAt: faker.date.future() })
      );
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      const result = await service.upsert(params, { runtimeLimitHours: 24 });

      expect(domainEvents.publish).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ runtimeLimitHours: 24 }));
    });
  });

  function createDeploymentSettingsOutput(overrides: Partial<DeploymentSettingsOutput> = {}): DeploymentSettingsOutput {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      dseq: faker.string.numeric(6),
      autoTopUpEnabled: false,
      closed: false,
      lastFundedAt: null,
      runtimeLimitHours: null,
      runtimeEndsAt: null,
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
    const domainEvents = mock<DomainEventsService>();

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
      instrumentation,
      domainEvents
    );

    return {
      service,
      deploymentSettingRepository,
      authService,
      drainingDeploymentService,
      walletReloadJobService,
      config,
      userWalletRepository,
      instrumentation,
      domainEvents
    };
  }
});
