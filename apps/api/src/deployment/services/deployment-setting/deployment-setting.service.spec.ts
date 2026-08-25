import "@test/mocks/logger-service.mock";

import { ForbiddenError } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { PostgresError } from "postgres";
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

    it("leaves auto top-up to the repository default rather than deciding it from the wallet", async () => {
      const { service, deploymentSettingRepository, userWalletRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const created = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(created);

      const result = await service.findOrCreateByUserIdAndDseq(params);

      expect(deploymentSettingRepository.create).toHaveBeenCalledWith(params);
      expect(userWalletRepository.findOneByUserId).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: true }));
    });

    it("schedules no wallet reload for a deployment whose owner asked for nothing", async () => {
      const { service, deploymentSettingRepository, walletReloadJobService } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true }));

      await service.findOrCreateByUserIdAndDseq(params);

      expect(walletReloadJobService.scheduleImmediate).not.toHaveBeenCalled();
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

    it("forces auto top-up on when a first limit arrives with it disabled", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12, autoTopUpEnabled: true }));

      await service.upsert(params, { runtimeLimitHours: 12, autoTopUpEnabled: false });

      expect(deploymentSettingRepository.create).toHaveBeenCalledWith({ ...params, runtimeLimitHours: 12, autoTopUpEnabled: true });
    });

    it("returns 409 when the guarded update finds no eligible row", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));
      deploymentSettingRepository.applyRuntimeLimit.mockResolvedValue(undefined);

      await expect(service.upsert(params, { runtimeLimitHours: 24 })).rejects.toMatchObject({ status: 409 });
    });

    it("raises the limit against a row created while the first insert was in flight", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const concurrent = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValueOnce(undefined).mockResolvedValueOnce(concurrent);
      deploymentSettingRepository.create.mockRejectedValue(createUniqueViolation());
      deploymentSettingRepository.applyRuntimeLimit.mockResolvedValue({ ...concurrent, runtimeLimitHours: 12 });

      const result = await service.upsert(params, { runtimeLimitHours: 12 });

      expect(deploymentSettingRepository.applyRuntimeLimit).toHaveBeenCalledWith({ ...params, runtimeLimitHours: 12, maxIncrementHours: 48 });
      expect(result).toEqual(expect.objectContaining({ runtimeLimitHours: 12 }));
    });

    it("patches the row created while the first insert was in flight", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const concurrent = createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: false });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValueOnce(undefined).mockResolvedValueOnce(concurrent);
      deploymentSettingRepository.updateBy.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ ...concurrent, autoTopUpEnabled: true } as never);
      deploymentSettingRepository.create.mockRejectedValue(createUniqueViolation());

      const result = await service.upsert(params, { autoTopUpEnabled: true });

      expect(deploymentSettingRepository.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.objectContaining({ autoTopUpEnabled: true }));
    });

    it("returns 409 when the row behind the insert conflict is already gone", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.create.mockRejectedValue(createUniqueViolation());

      await expect(service.upsert(params, { runtimeLimitHours: 12 })).rejects.toMatchObject({ status: 409 });
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

  describe("upsert removing a runtime limit", () => {
    it("clears the limit and its deadline", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(
        createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12, runtimeEndsAt: faker.date.future() })
      );
      deploymentSettingRepository.updateBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: null }) as never);

      const result = await service.upsert(params, { runtimeLimitHours: null });

      expect(deploymentSettingRepository.updateBy).toHaveBeenCalledWith(params, { runtimeLimitHours: null, runtimeEndsAt: null }, { returning: true });
      expect(result).toEqual(expect.objectContaining({ runtimeLimitHours: null, runtimeEndsAt: null }));
    });

    it("keeps a requested auto top-up change alongside the removal", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));
      deploymentSettingRepository.updateBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, autoTopUpEnabled: true }) as never);

      await service.upsert(params, { runtimeLimitHours: null, autoTopUpEnabled: true });

      expect(deploymentSettingRepository.updateBy).toHaveBeenCalledWith(
        params,
        { autoTopUpEnabled: true, runtimeLimitHours: null, runtimeEndsAt: null },
        { returning: true }
      );
    });

    it("creates an unlimited setting when the deployment has none", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(undefined);
      deploymentSettingRepository.updateBy.mockResolvedValue(undefined as never);
      deploymentSettingRepository.create.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: null }));

      const result = await service.upsert(params, { runtimeLimitHours: null });

      expect(deploymentSettingRepository.create).toHaveBeenCalledWith(expect.objectContaining({ ...params, runtimeLimitHours: null, runtimeEndsAt: null }));
      expect(result).toEqual(expect.objectContaining({ runtimeLimitHours: null }));
    });

    it("rejects a removal on a closed deployment", async () => {
      const { service, deploymentSettingRepository } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12, closed: true }));

      await expect(service.upsert(params, { runtimeLimitHours: null })).rejects.toMatchObject({ status: 400 });
      expect(deploymentSettingRepository.updateBy).not.toHaveBeenCalled();
    });

    it("publishes a funding command when the removed limit was anchored", async () => {
      const { service, deploymentSettingRepository, userWalletRepository, domainEvents } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };
      const wallet = createUserWallet({ userId: params.userId });

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(
        createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12, runtimeEndsAt: faker.date.future() })
      );
      deploymentSettingRepository.updateBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: null }) as never);
      userWalletRepository.findOneByUserId.mockResolvedValue(wallet);

      await service.upsert(params, { runtimeLimitHours: null });

      expect(domainEvents.publish).toHaveBeenCalledWith(
        expect.objectContaining({ data: { walletId: wallet.id, address: wallet.address, dseq: params.dseq } }),
        { singletonKey: `${FundDeploymentCommand.name}.${params.dseq}.${wallet.id}` }
      );
    });

    it("does not publish a funding command when the removed limit was never anchored", async () => {
      const { service, deploymentSettingRepository, domainEvents } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12, runtimeEndsAt: null }));
      deploymentSettingRepository.updateBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: null }) as never);

      await service.upsert(params, { runtimeLimitHours: null });

      expect(domainEvents.publish).not.toHaveBeenCalled();
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

    it("returns the raised limit when the wallet lookup behind the funding command fails", async () => {
      const { service, deploymentSettingRepository, userWalletRepository, domainEvents } = setup();
      const params = { userId: faker.string.uuid(), dseq: faker.string.numeric(6) };

      deploymentSettingRepository.accessibleBy.mockReturnValue(deploymentSettingRepository);
      deploymentSettingRepository.findOneBy.mockResolvedValue(createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 12 }));
      deploymentSettingRepository.applyRuntimeLimit.mockResolvedValue(
        createDeploymentSettingsOutput({ ...params, runtimeLimitHours: 24, runtimeEndsAt: faker.date.future() })
      );
      userWalletRepository.findOneByUserId.mockRejectedValue(new Error("connection terminated"));

      const result = await service.upsert(params, { runtimeLimitHours: 24 });

      expect(result).toEqual(expect.objectContaining({ runtimeLimitHours: 24 }));
      expect(domainEvents.publish).not.toHaveBeenCalled();
    });
  });

  /** Mirrors how drizzle surfaces a unique violation: a wrapper error carrying the driver error as its cause. */
  function createUniqueViolation() {
    const driverError = Object.assign(Object.create(PostgresError.prototype), {
      name: "PostgresError",
      code: "23505",
      constraint_name: "dseq_user_id_idx",
      message: 'duplicate key value violates unique constraint "dseq_user_id_idx"'
    });

    return new Error("Failed query: insert into deployment_settings", { cause: driverError });
  }

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
      runtimeEndingNotifiedFor: null,
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
