import { faker } from "@faker-js/faker";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import moduleConfig, { type AlertConfig } from "@src/modules/alert/config";
import { DeploymentNameClient } from "@src/modules/alert/services/deployment-name-client/deployment-name-client.service";
import { DeploymentReferenceService } from "./deployment-reference.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";

describe(DeploymentReferenceService.name, () => {
  describe("referTo", () => {
    it("labels the deployment by its name in quotes", async () => {
      const { service, deploymentNameClient } = await setup();
      const owner = mockAkashAddress();
      deploymentNameClient.findName.mockResolvedValue("my-app");

      const { label } = await service.referTo({ owner, dseq: "12345", organizationId: null });

      expect(label).toBe("“my-app”");
      expect(deploymentNameClient.findName).toHaveBeenCalledWith({ owner, dseq: "12345" });
    });

    it("labels a deployment that has no name by its dseq", async () => {
      const { service, deploymentNameClient } = await setup();
      deploymentNameClient.findName.mockResolvedValue(null);

      const { label } = await service.referTo({ owner: mockAkashAddress(), dseq: "12345", organizationId: null });

      expect(label).toBe("12345");
    });

    it("labels the deployment by its dseq and logs why when its name cannot be looked up", async () => {
      const { service, deploymentNameClient, loggerService } = await setup();
      const owner = mockAkashAddress();
      const error = new Error("console-api answered 503");
      deploymentNameClient.findName.mockRejectedValue(error);

      const { label } = await service.referTo({ owner, dseq: "12345", organizationId: null });

      expect(label).toBe("12345");
      expect(loggerService.warn).toHaveBeenCalledWith({ event: "DEPLOYMENT_NAME_LOOKUP_FAILED", owner, dseq: "12345", error });
    });

    it("links to the deployment in the organization the alert is filed in", async () => {
      const { service, consoleWebUrl } = await setup();
      const organizationId = faker.string.uuid();

      const { link } = await service.referTo({ owner: mockAkashAddress(), dseq: "12345", organizationId });

      expect(link).toBe(`<a href="https://${consoleWebUrl}/deployments/12345?org=${organizationId}">${consoleWebUrl}</a>`);
    });

    it("links to a tab of the deployment in the alert's organization", async () => {
      const { service, consoleWebUrl } = await setup();
      const organizationId = faker.string.uuid();

      const { link } = await service.referTo({ owner: mockAkashAddress(), dseq: "12345", organizationId, tab: "SETTINGS" });

      expect(link).toBe(`<a href="https://${consoleWebUrl}/deployments/12345?tab=SETTINGS&org=${organizationId}">${consoleWebUrl}</a>`);
    });

    it("links to a tab of the deployment of an alert filed in no organization", async () => {
      const { service, consoleWebUrl } = await setup();

      const { link } = await service.referTo({ owner: mockAkashAddress(), dseq: "12345", organizationId: null, tab: "SETTINGS" });

      expect(link).toBe(`<a href="https://${consoleWebUrl}/deployments/12345?tab=SETTINGS">${consoleWebUrl}</a>`);
    });

    it("links to the deployment with no query when the alert is filed in no organization and no tab is asked for", async () => {
      const { service, consoleWebUrl } = await setup();

      const { link } = await service.referTo({ owner: mockAkashAddress(), dseq: "12345", organizationId: null });

      expect(link).toBe(`<a href="https://${consoleWebUrl}/deployments/12345">${consoleWebUrl}</a>`);
    });
  });

  async function setup() {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(moduleConfig)],
      providers: [DeploymentReferenceService, MockProvider(DeploymentNameClient), MockProvider(LoggerService)]
    }).compile();

    return {
      service: module.get(DeploymentReferenceService),
      deploymentNameClient: module.get<MockProxy<DeploymentNameClient>>(DeploymentNameClient),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      consoleWebUrl: module.get<ConfigService<AlertConfig>>(ConfigService).getOrThrow("alert.CONSOLE_WEB_URL")
    };
  }
});
