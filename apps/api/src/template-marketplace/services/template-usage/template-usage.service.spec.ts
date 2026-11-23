import { faker } from "@faker-js/faker";
import { addHours } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger, JobQueueService, TxService } from "@src/core";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type {
  TemplateUsageEventRepository,
  VersionedTemplate
} from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { CheckTemplateDeploymentStillRunning } from "@src/template-marketplace/services/check-template-deployment-still-running/check-template-deployment-still-running.job";
import type { UserOutput } from "@src/user/repositories";
import { TemplateUsageService } from "./template-usage.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const IMPORTED_REF = "akash-network-awesome-akash-comfyui";

describe(TemplateUsageService.name, () => {
  describe("recordDeployed", () => {
    it("records a deploy of an imported template under its awesome-akash id, with the version deployed, and tells analytics the same id", async () => {
      const templateVersionId = faker.string.uuid();
      const { service, templateUsageEventRepository, analyticsService } = setup({ template: { importedRef: IMPORTED_REF, isOfficial: true } });
      const definition = buildDefinition({ templateVersionId });

      await service.recordDeployed(definition, { isTrialing: false });

      expect(templateUsageEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ source: "awesome_akash", templateRef: IMPORTED_REF, templateVersionId, action: "deploy" })
      );
      expect(analyticsService.track).toHaveBeenCalledWith(
        definition.userId,
        "template_deployed",
        { source: "official", template_id: IMPORTED_REF, template_version: 3, network: "mainnet" },
        { insertId: `template_deploy:${definition.id}` }
      );
    });

    it("records a Console template deploy by its template id and version", async () => {
      const templateId = faker.string.uuid();
      const templateVersionId = faker.string.uuid();
      const { service, templateUsageEventRepository } = setup({ templateIdOfVersion: templateId });
      const definition = buildDefinition({ templateVersionId });

      await service.recordDeployed(definition, { isTrialing: false });

      expect(templateUsageEventRepository.findTemplateOfVersion).toHaveBeenCalledWith(templateVersionId);
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

      expect(templateUsageEventRepository.findTemplateOfVersion).not.toHaveBeenCalled();
      expect(templateUsageEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ source: "awesome_akash", templateRef: "akash-network-awesome-akash-ollama", templateVersionId: null, action: "deploy" })
      );
    });

    it("records nothing for a deployment from no template", async () => {
      const { service, templateUsageEventRepository, logger } = setup();

      await service.recordDeployed(buildDefinition(), { isTrialing: false });

      expect(templateUsageEventRepository.findTemplateOfVersion).not.toHaveBeenCalled();
      expect(templateUsageEventRepository.record).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
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
      templateUsageEventRepository.findTemplateOfVersion.mockRejectedValue(new Error("connection reset"));

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
        isTrial: true,
        createdAt: leaseCreatedAt
      });
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new CheckTemplateDeploymentStillRunning({ deploymentSettingId: setting.id, walletId: wallet.id, dseq: setting.dseq, isTrial: true }),
        { singletonKey: `checkTemplateDeploymentStillRunning.${setting.id}`, startAfter: addHours(leaseCreatedAt, 24) }
      );
    });

    it.each([
      { wasTrialing: true, isTrialingNow: false },
      { wasTrialing: false, isTrialingNow: true }
    ])("records the trial state the lease was signed with ($wasTrialing) over the wallet's current one", async ({ wasTrialing, isTrialingNow }) => {
      const wallet = createUserWallet({ isTrialing: isTrialingNow });
      const setting = buildSetting({ templateId: "hello-world" });
      const { service, templateUsageEventRepository, jobQueueService } = setup({ wallet, setting });

      await service.recordLeaseCreated({ walletId: wallet.id, dseq: setting.dseq, leaseCreatedAt: new Date(), wasTrialing });

      expect(templateUsageEventRepository.record).toHaveBeenCalledWith(expect.objectContaining({ action: "lease_created", isTrial: wasTrialing }));
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new CheckTemplateDeploymentStillRunning({ deploymentSettingId: setting.id, walletId: wallet.id, dseq: setting.dseq, isTrial: wasTrialing }),
        expect.anything()
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

    it("throws a failed insert so the job retries it", async () => {
      const setting = buildSetting({ templateId: "hello-world" });
      const { service, templateUsageEventRepository, txService, logger } = setup({ setting });
      const failure = new Error("connection reset");
      templateUsageEventRepository.record.mockRejectedValue(failure);

      await expect(service.recordStillRunning({ deploymentSettingId: setting.id, dseq: setting.dseq, isTrial: true })).rejects.toBe(failure);

      expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("recordFork", () => {
    it("counts a copy made from outside the publishing organization against the version it copied, in the caller's own transaction", async () => {
      const { service, templateUsageEventRepository, txService } = setup({ network: "sandbox" });
      const source = { id: faker.string.uuid(), organizationId: faker.string.uuid(), currentVersionId: faker.string.uuid() };
      const fork = { userId: faker.string.uuid(), organizationId: faker.string.uuid() };

      await service.recordFork(source, fork);

      expect(templateUsageEventRepository.recordForkOncePerDay).toHaveBeenCalledWith({
        source: "console",
        templateRef: source.id,
        templateVersionId: source.currentVersionId,
        userId: fork.userId,
        organizationId: fork.organizationId,
        network: "sandbox"
      });
      expect(txService.outsideTransaction).not.toHaveBeenCalled();
    });

    it("counts a copy of an imported template under the awesome-akash id its usage is kept by", async () => {
      const { service, templateUsageEventRepository } = setup();
      const source = { id: faker.string.uuid(), organizationId: faker.string.uuid(), currentVersionId: faker.string.uuid(), importedRef: IMPORTED_REF };

      await service.recordFork(source, { userId: faker.string.uuid(), organizationId: faker.string.uuid() });

      expect(templateUsageEventRepository.recordForkOncePerDay).toHaveBeenCalledWith(
        expect.objectContaining({ source: "awesome_akash", templateRef: IMPORTED_REF, templateVersionId: source.currentVersionId })
      );
    });

    it("counts no copy made inside the publishing organization", async () => {
      const { service, templateUsageEventRepository } = setup();
      const organizationId = faker.string.uuid();

      await service.recordFork({ id: faker.string.uuid(), organizationId, currentVersionId: null }, { userId: faker.string.uuid(), organizationId });

      expect(templateUsageEventRepository.recordForkOncePerDay).not.toHaveBeenCalled();
    });

    it("fails the copy when the fork cannot be recorded, since both share one transaction", async () => {
      const { service, templateUsageEventRepository } = setup();
      templateUsageEventRepository.recordForkOncePerDay.mockRejectedValue(new Error("connection lost"));

      await expect(
        service.recordFork(
          { id: faker.string.uuid(), organizationId: faker.string.uuid(), currentVersionId: null },
          { userId: faker.string.uuid(), organizationId: faker.string.uuid() }
        )
      ).rejects.toThrow("connection lost");
    });
  });

  describe("recordFavorite", () => {
    it.each(["favorite", "unfavorite"] as const)("records a %s of the template's current version by the caller in their active organization", async action => {
      const templateId = faker.string.uuid();
      const currentVersionId = faker.string.uuid();
      const { service, templateUsageEventRepository, txService, user, activeOrganizationId } = setup({ currentVersionId, network: "sandbox" });

      await service.recordFavorite(templateId, action);

      expect(templateUsageEventRepository.findReferencedTemplate).toHaveBeenCalledWith(templateId);
      expect(templateUsageEventRepository.record).toHaveBeenCalledWith({
        source: "console",
        templateRef: templateId,
        templateVersionId: currentVersionId,
        action,
        userId: user!.id,
        organizationId: activeOrganizationId,
        network: "sandbox"
      });
      expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
    });

    it("records a favorite of a template without a version, by a caller outside any organization", async () => {
      const templateId = faker.string.uuid();
      const { service, templateUsageEventRepository, user } = setup({ currentVersionId: null, activeOrganizationId: null });

      await service.recordFavorite(templateId, "favorite");

      expect(templateUsageEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ templateRef: templateId, templateVersionId: null, userId: user!.id, organizationId: null })
      );
    });

    it("records a favorite of an imported template under the awesome-akash id its usage is kept by", async () => {
      const currentVersionId = faker.string.uuid();
      const { service, templateUsageEventRepository } = setup({ currentVersionId, importedRef: IMPORTED_REF });

      await service.recordFavorite(faker.string.uuid(), "favorite");

      expect(templateUsageEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ source: "awesome_akash", templateRef: IMPORTED_REF, templateVersionId: currentVersionId })
      );
    });

    it("records a favorite of a template that is gone by its id, with no version", async () => {
      const templateId = faker.string.uuid();
      const { service, templateUsageEventRepository } = setup({ isTemplateGone: true });

      await service.recordFavorite(templateId, "unfavorite");

      expect(templateUsageEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ source: "console", templateRef: templateId, templateVersionId: null })
      );
    });

    it("records a favorite with no user when the caller is unknown", async () => {
      const { service, templateUsageEventRepository } = setup({ user: null });

      await service.recordFavorite(faker.string.uuid(), "favorite");

      expect(templateUsageEventRepository.record).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
    });

    it("logs instead of throwing when there is no request context to read the caller from", async () => {
      const templateId = faker.string.uuid();
      const error = new Error("No context available");
      const { service, templateUsageEventRepository, executionContextService, logger } = setup();
      executionContextService.get.mockImplementation(() => {
        throw error;
      });

      await expect(service.recordFavorite(templateId, "favorite")).resolves.toBeUndefined();

      expect(templateUsageEventRepository.record).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "TEMPLATE_USAGE_RECORD_FAILED", action: "favorite", templateId, error });
    });

    it("logs a failed favorite instead of throwing", async () => {
      const templateId = faker.string.uuid();
      const error = new Error("insert failed");
      const { service, templateUsageEventRepository, logger } = setup();
      templateUsageEventRepository.record.mockRejectedValue(error);

      await expect(service.recordFavorite(templateId, "unfavorite")).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith({ event: "TEMPLATE_USAGE_RECORD_FAILED", action: "unfavorite", templateId, error });
    });
  });

  describe("analytics", () => {
    it("tells analytics of a deploy with the template's source, id, version number and network, and nothing its author wrote", async () => {
      const templateId = faker.string.uuid();
      const { service, analyticsService, featureFlags } = setup({ templateIdOfVersion: templateId, network: "sandbox" });
      const definition = buildDefinition({ templateVersionId: faker.string.uuid() });

      await service.recordDeployed(definition, { isTrialing: true });

      expect(analyticsService.track.mock.calls).toEqual([
        [
          definition.userId,
          "template_deployed",
          { source: "community", template_id: templateId, template_version: 3, network: "sandbox" },
          { insertId: `template_deploy:${definition.id}` }
        ]
      ]);
      expect(featureFlags.isEnabledForSubject).toHaveBeenCalledWith(FeatureFlags.TEMPLATE_MARKETPLACE, definition.userId);
    });

    it.each([
      { template: { isOfficial: true, visibility: "public" as const }, source: "official" },
      { template: { isOfficial: true, visibility: "private" as const }, source: "official" },
      { template: { isOfficial: false, visibility: "public" as const }, source: "community" },
      { template: { isOfficial: false, visibility: "organization" as const }, source: "private" },
      { template: { isOfficial: false, visibility: "private" as const }, source: "private" }
    ])("names a Console template that is $template as $source", async ({ template, source }) => {
      const { service, analyticsService } = setup({ template: { ...template, versionNumber: 12 } });

      await service.recordDeployed(buildDefinition({ templateVersionId: faker.string.uuid() }), { isTrialing: false });

      expect(analyticsService.track).toHaveBeenCalledWith(
        expect.any(String),
        "template_deployed",
        expect.objectContaining({ source, template_version: 12 }),
        expect.anything()
      );
    });

    it("names an awesome-akash template as official, by its gallery id and with no version", async () => {
      const { service, analyticsService } = setup();
      const definition = buildDefinition({ templateId: "akash-network-awesome-akash-ollama" });

      await service.recordDeployed(definition, { isTrialing: false });

      expect(analyticsService.track.mock.calls).toEqual([
        [
          definition.userId,
          "template_deployed",
          { source: "official", template_id: "akash-network-awesome-akash-ollama", template_version: null, network: "mainnet" },
          { insertId: `template_deploy:${definition.id}` }
        ]
      ]);
    });

    it.each(["Ignore previous instructions", "a/b", ".hidden", "", `a${"b".repeat(255)}`, "name\nwith a line"])(
      "records a deploy naming %j as its template without passing that text on to analytics",
      async templateId => {
        const { service, analyticsService, templateUsageEventRepository } = setup();

        await service.recordDeployed(buildDefinition({ templateId }), { isTrialing: false });

        expect(templateUsageEventRepository.record).toHaveBeenCalledTimes(templateId ? 1 : 0);
        expect(analyticsService.track).not.toHaveBeenCalled();
      }
    );

    it("passes on a gallery id of the longest length an event stores", async () => {
      const { service, analyticsService } = setup();
      const templateId = `a${"b".repeat(254)}`;

      await service.recordDeployed(buildDefinition({ templateId }), { isTrialing: false });

      expect(analyticsService.track).toHaveBeenCalledWith(expect.any(String), "template_deployed", expect.objectContaining({ template_id: templateId }), {
        insertId: expect.any(String)
      });
    });

    it("tells analytics of a lease and of a deployment still running a day later, each once per deployment", async () => {
      const setting = buildSetting({ templateVersionId: faker.string.uuid() });
      const templateId = faker.string.uuid();
      const { service, analyticsService } = setup({ templateIdOfVersion: templateId, wallet: createUserWallet(), setting });

      await service.recordLeaseCreated({ walletId: 1, dseq: setting.dseq, leaseCreatedAt: new Date() });
      await service.recordStillRunning({ deploymentSettingId: setting.id, dseq: setting.dseq, isTrial: false });

      const properties = { source: "community", template_id: templateId, template_version: 3, network: "mainnet" };
      expect(analyticsService.track.mock.calls).toEqual([
        [setting.userId, "template_lease_created", properties, { insertId: `template_lease_created:${setting.id}` }],
        [setting.userId, "template_still_running_24h", properties, { insertId: `template_still_running_24h:${setting.id}` }]
      ]);
    });

    it("tells analytics nothing of an event that was already recorded", async () => {
      const { service, analyticsService, templateUsageEventRepository } = setup({ isNewEvent: false });

      await service.recordDeployed(buildDefinition({ templateVersionId: faker.string.uuid() }), { isTrialing: false });

      expect(templateUsageEventRepository.record).toHaveBeenCalledTimes(1);
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("tells analytics nothing of a user the template marketplace is off for, and still records the event", async () => {
      const { service, analyticsService, templateUsageEventRepository } = setup({ isMarketplaceOff: true });

      await service.recordDeployed(buildDefinition({ templateVersionId: faker.string.uuid() }), { isTrialing: false });

      expect(templateUsageEventRepository.record).toHaveBeenCalledTimes(1);
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("tells analytics nothing of a deployment whose user is gone", async () => {
      const { service, analyticsService, featureFlags, templateUsageEventRepository } = setup();

      await service.recordDeployed({ ...buildDefinition({ templateVersionId: faker.string.uuid() }), userId: null }, { isTrialing: false });

      expect(templateUsageEventRepository.record).toHaveBeenCalledTimes(1);
      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(featureFlags.isEnabledForSubject).not.toHaveBeenCalled();
    });

    it("warns and carries on when analytics fails, so the lease is still followed up a day later", async () => {
      const setting = buildSetting({ templateVersionId: faker.string.uuid() });
      const { service, analyticsService, jobQueueService, logger } = setup({ wallet: createUserWallet(), setting });
      const error = new Error("analytics is down");
      analyticsService.track.mockImplementation(() => {
        throw error;
      });

      await service.recordLeaseCreated({ walletId: 1, dseq: setting.dseq, leaseCreatedAt: new Date() });

      expect(logger.warn).toHaveBeenCalledWith({ event: "TEMPLATE_USAGE_TRACK_FAILED", action: "lease_created", error });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    });

    it("warns and carries on when the flag cannot be read", async () => {
      const { service, analyticsService, featureFlags, logger } = setup();
      const error = new Error("flags are not ready");
      featureFlags.isEnabledForSubject.mockImplementation(() => {
        throw error;
      });

      await expect(service.recordStillRunning({ deploymentSettingId: faker.string.uuid(), dseq: "1", isTrial: false })).resolves.toBeUndefined();
      await service.recordDeployed(buildDefinition({ templateVersionId: faker.string.uuid() }), { isTrialing: false });

      expect(logger.warn).toHaveBeenCalledWith({ event: "TEMPLATE_USAGE_TRACK_FAILED", action: "deploy", error });
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("tells analytics of a counted fork once the copy is committed, against the version that was copied", async () => {
      const { service, analyticsService, templateUsageEventRepository, commit } = setup({ template: { isOfficial: true, versionNumber: 5 } });
      const source = { id: faker.string.uuid(), organizationId: faker.string.uuid(), currentVersionId: faker.string.uuid() };
      const fork = { userId: faker.string.uuid(), organizationId: faker.string.uuid() };
      templateUsageEventRepository.findTemplateOfVersion.mockResolvedValue({
        templateId: source.id,
        versionNumber: 5,
        isOfficial: true,
        visibility: "public",
        importedRef: null
      });

      await service.recordFork(source, fork);

      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(templateUsageEventRepository.findTemplateOfVersion).not.toHaveBeenCalled();

      await commit();

      expect(templateUsageEventRepository.findTemplateOfVersion).toHaveBeenCalledWith(source.currentVersionId);
      expect(analyticsService.track.mock.calls).toEqual([
        [fork.userId, "template_forked", { source: "official", template_id: source.id, template_version: 5, network: "mainnet" }, { insertId: undefined }]
      ]);
    });

    it("tells analytics nothing of a second copy the same day, which counts no fork", async () => {
      const { service, analyticsService, templateUsageEventRepository, txService } = setup({ isNewEvent: false });

      await service.recordFork(
        { id: faker.string.uuid(), organizationId: faker.string.uuid(), currentVersionId: faker.string.uuid() },
        { userId: faker.string.uuid(), organizationId: faker.string.uuid() }
      );

      expect(templateUsageEventRepository.findTemplateOfVersion).not.toHaveBeenCalled();
      expect(txService.afterCommit).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("tells analytics nothing of a fork whose source has no version, or whose version is gone", async () => {
      const { service, analyticsService, templateUsageEventRepository, txService, commit } = setup({ templateIdOfVersion: undefined });
      const fork = { userId: faker.string.uuid(), organizationId: faker.string.uuid() };

      await service.recordFork({ id: faker.string.uuid(), organizationId: faker.string.uuid(), currentVersionId: null }, fork);

      expect(templateUsageEventRepository.findTemplateOfVersion).not.toHaveBeenCalled();

      await service.recordFork({ id: faker.string.uuid(), organizationId: faker.string.uuid(), currentVersionId: faker.string.uuid() }, fork);
      await commit();

      expect(templateUsageEventRepository.findTemplateOfVersion).toHaveBeenCalledTimes(1);
      expect(txService.afterCommit).toHaveBeenCalledTimes(1);
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("keeps a committed fork when the copied template cannot be looked up for analytics", async () => {
      const { service, analyticsService, templateUsageEventRepository, logger, commit } = setup();
      const error = new Error("statement timeout");
      templateUsageEventRepository.findTemplateOfVersion.mockRejectedValue(error);

      await expect(
        service.recordFork(
          { id: faker.string.uuid(), organizationId: faker.string.uuid(), currentVersionId: faker.string.uuid() },
          { userId: faker.string.uuid(), organizationId: faker.string.uuid() }
        )
      ).resolves.toBeUndefined();
      await commit();

      expect(logger.warn).toHaveBeenCalledWith({ event: "TEMPLATE_USAGE_TRACK_FAILED", action: "fork", error });
      expect(analyticsService.track).not.toHaveBeenCalled();
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

    it("answers nothing for a deployment from no template", async () => {
      const { service } = setup();

      await expect(service.templateRefOf({ templateId: null, templateVersionId: null })).resolves.toBeUndefined();
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
      currentVersionId?: string | null;
      importedRef?: string;
      isTemplateGone?: boolean;
      user?: null;
      activeOrganizationId?: string | null;
      template?: Partial<VersionedTemplate>;
      isNewEvent?: boolean;
      isMarketplaceOff?: boolean;
    } = {}
  ) {
    const templateUsageEventRepository = mock<TemplateUsageEventRepository>();
    const templateId = "templateIdOfVersion" in input ? input.templateIdOfVersion : faker.string.uuid();
    templateUsageEventRepository.findTemplateOfVersion.mockResolvedValue(
      templateId ? { templateId, versionNumber: 3, isOfficial: false, visibility: "public", importedRef: null, ...input.template } : undefined
    );
    templateUsageEventRepository.record.mockResolvedValue(input.isNewEvent ?? true);
    templateUsageEventRepository.recordForkOncePerDay.mockResolvedValue(input.isNewEvent ?? true);
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
    const runAfterCommit: Array<() => void> = [];
    txService.afterCommit.mockImplementation(run => {
      runAfterCommit.push(run);
    });
    const analyticsService = mock<AnalyticsService>();
    const featureFlags = mock<FeatureFlagsService>();
    featureFlags.isEnabledForSubject.mockImplementation(flag => flag === FeatureFlags.TEMPLATE_MARKETPLACE && !input.isMarketplaceOff);
    templateUsageEventRepository.findReferencedTemplate.mockResolvedValue(
      input.isTemplateGone
        ? undefined
        : { currentVersionId: input.currentVersionId === undefined ? faker.string.uuid() : input.currentVersionId, importedRef: input.importedRef ?? null }
    );
    const user = input.user === null ? undefined : mock<UserOutput>({ id: faker.string.uuid() });
    const activeOrganizationId = input.activeOrganizationId === undefined ? faker.string.uuid() : input.activeOrganizationId;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.calledWith("CURRENT_USER").mockReturnValue(user);
    executionContextService.get
      .calledWith("ORGANIZATION_CONTEXT")
      .mockReturnValue(activeOrganizationId ? createOrganizationContext({ organizationId: activeOrganizationId }) : undefined);
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new TemplateUsageService(
      templateUsageEventRepository,
      userWalletRepository,
      deploymentSettingRepository,
      jobQueueService,
      coreConfig,
      txService,
      executionContextService,
      analyticsService,
      featureFlags,
      createLogger
    );

    return {
      service,
      templateUsageEventRepository,
      userWalletRepository,
      deploymentSettingRepository,
      jobQueueService,
      coreConfig,
      txService,
      logger,
      user,
      activeOrganizationId,
      executionContextService,
      analyticsService,
      featureFlags,
      commit: async () => {
        runAfterCommit.forEach(run => run());
        await new Promise(resolve => setImmediate(resolve));
      }
    };
  }
});
