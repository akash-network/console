import { faker } from "@faker-js/faker";
import { addHours } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger, JobQueueService, TxService } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { CheckTemplateDeploymentStillRunning } from "@src/template-marketplace/services/check-template-deployment-still-running/check-template-deployment-still-running.job";
import { TemplateUsageService } from "./template-usage.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(TemplateUsageService.name, () => {
  describe("recordDeployed", () => {
    it("records a Console template deploy by its template id and version", async () => {
      const templateId = faker.string.uuid();
      const templateVersionId = faker.string.uuid();
      const { service, templateUsageEventRepository } = setup({ templateIdOfVersion: templateId });
      const definition = buildDefinition({ templateVersionId });

      await service.recordDeployed(definition, { isTrialing: false });

      expect(templateUsageEventRepository.findTemplateIdOfVersion).toHaveBeenCalledWith(templateVersionId);
      expect(templateUsageEventRepository.record).toHaveBeenCalledTimes(1);
      expect(templateUsageEventRepository.record).toHaveBeenCalledWith({
        source: "console",
        templateRef: templateId,
        templateVersionId,
        action: "deploy",
        userId: definition.userId,
        organizationId: definition.organizationId,
        deploymentSettingId: definition.id,
        dseq: definition.dseq,
        network: "mainnet",
        isTrial: false
      });
    });

    it("records an awesome-akash deploy by its gallery id without a version", async () => {
      const { service, templateUsageEventRepository } = setup();
      const definition = buildDefinition({ templateId: "akash-network-awesome-akash-ollama" });

      await service.recordDeployed(definition, { isTrialing: false });

      expect(templateUsageEventRepository.findTemplateIdOfVersion).not.toHaveBeenCalled();
      expect(templateUsageEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ source: "awesome_akash", templateRef: "akash-network-awesome-akash-ollama", templateVersionId: null, action: "deploy" })
      );
    });

    it("records nothing for a deployment from no template", async () => {
      const { service, templateUsageEventRepository } = setup();

      await service.recordDeployed(buildDefinition(), { isTrialing: false });

      expect(templateUsageEventRepository.findTemplateIdOfVersion).not.toHaveBeenCalled();
      expect(templateUsageEventRepository.record).not.toHaveBeenCalled();
    });

    it("records nothing for a version whose template is gone", async () => {
      const { service, templateUsageEventRepository } = setup({ templateIdOfVersion: undefined });

      await service.recordDeployed(buildDefinition({ templateVersionId: faker.string.uuid() }), { isTrialing: false });

      expect(templateUsageEventRepository.record).not.toHaveBeenCalled();
    });

    it("records the network and whether the wallet is trialing", async () => {
      const { service, templateUsageEventRepository } = setup({ network: "sandbox" });
      const definition = buildDefinition({ templateId: "hello-world" });

      await service.recordDeployed(definition, { isTrialing: true });
      await service.recordDeployed(definition, { isTrialing: null });

      expect(templateUsageEventRepository.record.mock.calls.map(([event]) => [event.network, event.isTrial])).toEqual([
        ["sandbox", true],
        ["sandbox", false]
      ]);
    });

    it("logs a failed insert instead of throwing", async () => {
      const { service, templateUsageEventRepository, logger } = setup();
      const failure = new Error("connection reset");
      templateUsageEventRepository.record.mockRejectedValue(failure);
      const definition = buildDefinition({ templateId: "hello-world" });

      await expect(service.recordDeployed(definition, { isTrialing: false })).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith({
        event: "TEMPLATE_USAGE_RECORD_FAILED",
        action: "deploy",
        deploymentSettingId: definition.id,
        dseq: definition.dseq,
        error: failure
      });
    });

    it("logs a failed version lookup instead of throwing", async () => {
      const { service, templateUsageEventRepository, logger } = setup();
      templateUsageEventRepository.findTemplateIdOfVersion.mockRejectedValue(new Error("connection reset"));

      await expect(service.recordDeployed(buildDefinition({ templateVersionId: faker.string.uuid() }), { isTrialing: false })).resolves.toBeUndefined();

      expect(templateUsageEventRepository.record).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TEMPLATE_USAGE_RECORD_FAILED", action: "deploy" }));
    });
  });

  describe("recordLeaseCreated", () => {
    it("records the lease and schedules the check a day after it", async () => {
      const wallet = createUserWallet({ isTrialing: true });
      const setting = buildSetting({ templateId: "hello-world" });
      const leaseCreatedAt = new Date("2026-11-07T10:00:00.000Z");
      const { service, templateUsageEventRepository, userWalletRepository, deploymentSettingRepository, jobQueueService, txService } = setup({
        wallet,
        setting
      });

      await service.recordLeaseCreated({ walletId: wallet.id, dseq: setting.dseq, leaseCreatedAt });

      expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ id: wallet.id });
      expect(deploymentSettingRepository.findOneOfWallet).toHaveBeenCalledWith(wallet, setting.dseq);
      expect(templateUsageEventRepository.record).toHaveBeenCalledWith({
        source: "awesome_akash",
        templateRef: "hello-world",
        templateVersionId: null,
        action: "lease_created",
        userId: setting.userId,
        organizationId: setting.organizationId,
        deploymentSettingId: setting.id,
        dseq: setting.dseq,
        network: "mainnet",
        isTrial: true
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new CheckTemplateDeploymentStillRunning({ deploymentSettingId: setting.id, walletId: wallet.id, dseq: setting.dseq, isTrial: true }),
        { singletonKey: `checkTemplateDeploymentStillRunning.${setting.id}`, startAfter: addHours(leaseCreatedAt, 24) }
      );
    });

    it("schedules nothing for a deployment from no template", async () => {
      const wallet = createUserWallet();
      const setting = buildSetting();
      const { service, templateUsageEventRepository, jobQueueService } = setup({ wallet, setting });

      await service.recordLeaseCreated({ walletId: wallet.id, dseq: setting.dseq, leaseCreatedAt: new Date() });

      expect(templateUsageEventRepository.record).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("schedules nothing for a lease of a wallet that is gone", async () => {
      const { service, deploymentSettingRepository, jobQueueService } = setup({ wallet: undefined, setting: buildSetting({ templateId: "hello-world" }) });

      await service.recordLeaseCreated({ walletId: 1, dseq: "123", leaseCreatedAt: new Date() });

      expect(deploymentSettingRepository.findOneOfWallet).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("schedules nothing for a deployment the console holds no record of", async () => {
      const wallet = createUserWallet();
      const { service, templateUsageEventRepository, jobQueueService } = setup({ wallet, setting: undefined });

      await service.recordLeaseCreated({ walletId: wallet.id, dseq: "123", leaseCreatedAt: new Date() });

      expect(templateUsageEventRepository.record).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("still schedules the check when the lease was recorded before", async () => {
      const wallet = createUserWallet();
      const setting = buildSetting({ templateId: "hello-world" });
      const { service, templateUsageEventRepository, jobQueueService } = setup({ wallet, setting });
      templateUsageEventRepository.record.mockResolvedValue(false);

      await service.recordLeaseCreated({ walletId: wallet.id, dseq: setting.dseq, leaseCreatedAt: new Date() });

      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    });

    it("logs a failed insert instead of throwing", async () => {
      const wallet = createUserWallet();
      const setting = buildSetting({ templateId: "hello-world" });
      const { service, templateUsageEventRepository, jobQueueService, logger } = setup({ wallet, setting });
      const failure = new Error("connection reset");
      templateUsageEventRepository.record.mockRejectedValue(failure);

      await expect(service.recordLeaseCreated({ walletId: wallet.id, dseq: setting.dseq, leaseCreatedAt: new Date() })).resolves.toBeUndefined();

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({
        event: "TEMPLATE_USAGE_RECORD_FAILED",
        action: "lease_created",
        walletId: wallet.id,
        dseq: setting.dseq,
        error: failure
      });
    });

    it("logs a failed schedule instead of throwing", async () => {
      const wallet = createUserWallet();
      const setting = buildSetting({ templateId: "hello-world" });
      const { service, jobQueueService, logger } = setup({ wallet, setting });
      jobQueueService.enqueue.mockRejectedValue(new Error("queue down"));

      await expect(service.recordLeaseCreated({ walletId: wallet.id, dseq: setting.dseq, leaseCreatedAt: new Date() })).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TEMPLATE_USAGE_RECORD_FAILED", action: "lease_created" }));
    });
  });

  describe("recordStillRunning", () => {
    it("records a template deployment still running a day after its lease", async () => {
      const templateId = faker.string.uuid();
      const setting = buildSetting({ templateVersionId: faker.string.uuid() });
      const { service, templateUsageEventRepository, deploymentSettingRepository, txService } = setup({ setting, templateIdOfVersion: templateId });

      await service.recordStillRunning({ deploymentSettingId: setting.id, dseq: setting.dseq, isTrial: false });

      expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
      expect(deploymentSettingRepository.findById).toHaveBeenCalledWith(setting.id);
      expect(templateUsageEventRepository.record).toHaveBeenCalledWith({
        source: "console",
        templateRef: templateId,
        templateVersionId: setting.templateVersionId,
        action: "still_running_24h",
        userId: setting.userId,
        organizationId: setting.organizationId,
        deploymentSettingId: setting.id,
        dseq: setting.dseq,
        network: "mainnet",
        isTrial: false
      });
    });

    it("records the trial state the lease was created with", async () => {
      const setting = buildSetting({ templateId: "hello-world" });
      const { service, templateUsageEventRepository } = setup({ setting });

      await service.recordStillRunning({ deploymentSettingId: setting.id, dseq: setting.dseq, isTrial: true });

      expect(templateUsageEventRepository.record).toHaveBeenCalledWith(expect.objectContaining({ action: "still_running_24h", isTrial: true }));
    });

    it("records nothing for a deployment whose record is gone", async () => {
      const { service, templateUsageEventRepository, logger } = setup({ setting: undefined });

      await service.recordStillRunning({ deploymentSettingId: faker.string.uuid(), dseq: "123", isTrial: false });

      expect(templateUsageEventRepository.record).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("logs a failed insert as a warning instead of throwing", async () => {
      const setting = buildSetting({ templateId: "hello-world" });
      const { service, templateUsageEventRepository, logger } = setup({ setting });
      const failure = new Error("connection reset");
      templateUsageEventRepository.record.mockRejectedValue(failure);

      await expect(service.recordStillRunning({ deploymentSettingId: setting.id, dseq: setting.dseq, isTrial: true })).resolves.toBeUndefined();

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({
        event: "TEMPLATE_USAGE_RECORD_FAILED",
        action: "still_running_24h",
        deploymentSettingId: setting.id,
        dseq: setting.dseq,
        error: failure
      });
    });
  });

  describe("templateRefOf", () => {
    it("prefers the version over a gallery id", async () => {
      const templateId = faker.string.uuid();
      const templateVersionId = faker.string.uuid();
      const { service } = setup({ templateIdOfVersion: templateId });

      await expect(service.templateRefOf({ templateId: "hello-world", templateVersionId })).resolves.toEqual({
        source: "console",
        templateRef: templateId,
        templateVersionId
      });
    });
  });

  function buildDefinition(overrides: { templateId?: string | null; templateVersionId?: string | null } = {}) {
    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      organizationId: faker.string.uuid(),
      dseq: faker.string.numeric(10),
      templateId: null,
      templateVersionId: null,
      ...overrides
    };
  }

  function buildSetting(overrides: { templateId?: string | null; templateVersionId?: string | null } = {}) {
    return mock<DeploymentSettingsOutput>({ ...buildDefinition(overrides) });
  }

  function setup(
    input: {
      templateIdOfVersion?: string;
      network?: "mainnet" | "sandbox";
      wallet?: ReturnType<typeof createUserWallet>;
      setting?: DeploymentSettingsOutput;
    } = {}
  ) {
    const templateUsageEventRepository = mock<TemplateUsageEventRepository>();
    templateUsageEventRepository.findTemplateIdOfVersion.mockResolvedValue("templateIdOfVersion" in input ? input.templateIdOfVersion : faker.string.uuid());
    templateUsageEventRepository.record.mockResolvedValue(true);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneBy.mockResolvedValue(input.wallet);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findOneOfWallet.mockResolvedValue(input.setting);
    deploymentSettingRepository.findById.mockResolvedValue(input.setting);
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());
    const coreConfig = mockConfigService<CoreConfigService>({ NETWORK: input.network ?? "mainnet" });
    const txService = mock<TxService>();
    txService.outsideTransaction.mockImplementation(async cb => await cb());
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new TemplateUsageService(
      templateUsageEventRepository,
      userWalletRepository,
      deploymentSettingRepository,
      jobQueueService,
      coreConfig,
      txService,
      createLogger
    );

    return { service, templateUsageEventRepository, userWalletRepository, deploymentSettingRepository, jobQueueService, coreConfig, txService, logger };
  }
});
