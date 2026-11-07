import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, TxService } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { TemplateUsageService } from "./template-usage.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

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

      expect(logger.error).toHaveBeenCalledWith({
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
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "TEMPLATE_USAGE_RECORD_FAILED", action: "deploy" }));
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

  function setup(input: { templateIdOfVersion?: string; network?: "mainnet" | "sandbox" } = {}) {
    const templateUsageEventRepository = mock<TemplateUsageEventRepository>();
    templateUsageEventRepository.findTemplateIdOfVersion.mockResolvedValue("templateIdOfVersion" in input ? input.templateIdOfVersion : faker.string.uuid());
    templateUsageEventRepository.record.mockResolvedValue(true);
    const coreConfig = mockConfigService<CoreConfigService>({ NETWORK: input.network ?? "mainnet" });
    const txService = mock<TxService>();
    txService.outsideTransaction.mockImplementation(async cb => await cb());
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new TemplateUsageService(templateUsageEventRepository, coreConfig, txService, createLogger);

    return { service, templateUsageEventRepository, coreConfig, txService, logger };
  }
});
