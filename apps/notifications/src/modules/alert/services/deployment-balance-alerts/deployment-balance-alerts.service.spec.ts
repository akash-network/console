import { faker } from "@faker-js/faker";
import { ConfigModule } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { Err, Ok } from "ts-results";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { RichError } from "@src/lib/rich-error/rich-error";
import moduleConfig from "@src/modules/alert/config";
import type { AlertOutput, DeploymentBalanceAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { AlertMessageService } from "@src/modules/alert/services/alert-message/alert-message.service";
import { TemplateService } from "@src/modules/alert/services/template/template.service";
import { ConditionsMatcherService } from "../conditions-matcher/conditions-matcher.service";
import { DeploymentService } from "../deployment/deployment.service";
import { DeploymentBalanceAlertsService } from "./deployment-balance-alerts.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateAlertMessage } from "@test/seeders/alert-message.seeder";
import { generateDeploymentBalanceAlert } from "@test/seeders/deployment-balance-alert.seeder";

describe(DeploymentBalanceAlertsService.name, () => {
  describe("alertFor", () => {
    it("should alert for a given block and mark it as triggered", async () => {
      const { service, alertRepository, deploymentService, alertMessageService, onMessage } = await setup();
      const owner = mockAkashAddress();
      const dseq = faker.string.numeric(6);
      const alert = generateDeploymentBalanceAlert({
        params: {
          owner,
          dseq
        },
        conditions: { field: "balance", value: 10000000, operator: "lt" },
        minBlockHeight: 1000
      });
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });
      alertRepository.updateById.mockImplementation(
        async (id, update) =>
          ({
            ...alert,
            ...update
          }) as AlertOutput
      );
      const balance = { balance: 9000000 };
      deploymentService.getDeploymentBalance.mockResolvedValue(Ok(balance));
      const alertMessage = generateAlertMessage({
        notificationChannelId: alert.notificationChannelId
      });
      alertMessageService.getMessage.mockReturnValue(alertMessage.payload);

      await service.alertFor({ height: 1000 }, onMessage);

      expect(alertMessageService.getMessage).toHaveBeenCalledWith({
        summary: alert.summary,
        description: alert.description,
        vars: {
          alert: {
            prev: expect.objectContaining({ id: alert.id }),
            next: expect.objectContaining({ id: alert.id })
          },
          data: balance
        }
      });
      expect(onMessage).toHaveBeenCalledWith(alertMessage);
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
        status: "TRIGGERED"
      });
    });

    it("should recover an alert for a given block and mark it as OK", async () => {
      const { service, alertRepository, deploymentService, alertMessageService, onMessage } = await setup();
      const owner = mockAkashAddress();
      const dseq = faker.string.numeric(6);
      const alert = generateDeploymentBalanceAlert({
        params: {
          owner,
          dseq
        },
        conditions: { field: "balance", value: 10000000, operator: "lt" },
        minBlockHeight: 1000,
        status: "TRIGGERED"
      });
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });
      alertRepository.updateById.mockImplementation(
        async (id, update) =>
          ({
            ...alert,
            ...update
          }) as AlertOutput
      );

      const balance = { balance: 11000000 };
      deploymentService.getDeploymentBalance.mockResolvedValue(Ok(balance));
      const alertMessage = generateAlertMessage({
        notificationChannelId: alert.notificationChannelId
      });
      alertMessageService.getMessage.mockReturnValue(alertMessage.payload);

      await service.alertFor({ height: 1000 }, onMessage);

      expect(alertMessageService.getMessage).toHaveBeenCalledWith({
        summary: alert.summary,
        description: alert.description,
        vars: {
          alert: {
            prev: expect.objectContaining({ id: alert.id }),
            next: expect.objectContaining({ id: alert.id })
          },
          data: balance
        }
      });
      expect(onMessage).toHaveBeenCalledWith(alertMessage);
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010,
        status: "OK"
      });
    });

    it("should not proceed with an already triggered alert", async () => {
      const { service, alertRepository, deploymentService, alertMessageService } = await setup();
      const owner = mockAkashAddress();
      const dseq = faker.string.numeric(6);
      const alert = generateDeploymentBalanceAlert({
        params: {
          owner,
          dseq
        },
        conditions: { field: "balance", value: 10000000, operator: "lt" },
        minBlockHeight: 1000,
        status: "TRIGGERED"
      });
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });
      alertRepository.updateById.mockImplementation(
        async (id, update) =>
          ({
            ...alert,
            ...update
          }) as AlertOutput
      );

      const balance = { balance: 9000000 };
      deploymentService.getDeploymentBalance.mockResolvedValue(Ok(balance));
      const onMessage = jest.fn();

      await service.alertFor({ height: 1000 }, onMessage);

      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        minBlockHeight: 1010
      });
    });

    it("should disable an alert if the deployment balance is null", async () => {
      const { service, alertRepository, deploymentService, alertMessageService, onMessage } = await setup();
      const owner = mockAkashAddress();
      const dseq = faker.string.numeric(6);
      const alert = generateDeploymentBalanceAlert({
        params: {
          owner,
          dseq
        }
      });
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });
      alertRepository.updateById.mockImplementation(
        async (id, update) =>
          ({
            ...alert,
            ...update
          }) as AlertOutput
      );

      deploymentService.getDeploymentBalance.mockResolvedValue(Err(new RichError("Deployment closed", "DEPLOYMENT_CLOSED")));
      const alertMessage = generateAlertMessage({
        notificationChannelId: alert.notificationChannelId
      });
      alertMessageService.getMessage.mockReturnValue(alertMessage.payload);

      await service.alertFor({ height: 1000 }, onMessage);

      expect(alertMessageService.getMessage).toHaveBeenCalledWith({
        summary: alert.summary,
        description: alert.description,
        vars: {
          alert: {
            prev: expect.objectContaining({ id: alert.id }),
            next: expect.objectContaining({ id: alert.id })
          },
          data: {
            cause: "DEPLOYMENT_CLOSED"
          }
        }
      });
      expect(onMessage).toHaveBeenCalledWith(alertMessage);
      expect(alertRepository.updateById).toHaveBeenCalledWith(alert.id, {
        enabled: false
      });
    });

    it("should log error if alert repository call fails and reject", async () => {
      const { service, alertRepository, loggerService, alertMessageService } = await setup();
      const error = new Error("test");
      alertRepository.paginateAll.mockRejectedValue(error);
      const block = { height: 1000 };
      const onMessage = jest.fn();

      await expect(service.alertFor(block, onMessage)).rejects.toBe(error);

      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(alertRepository.updateById).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: "ALERT_FAILURE",
        block: block.height,
        error
      });
    });

    it("should log a single alert error", async () => {
      const { service, alertRepository, deploymentService, alertMessageService, loggerService } = await setup();
      const alert = generateDeploymentBalanceAlert({});
      const alerts: DeploymentBalanceAlertOutput[] = [alert];
      alertRepository.paginateAll.mockImplementation(async options => {
        await options.callback(alerts as any);
      });
      const error = new Error("test");
      deploymentService.getDeploymentBalance.mockRejectedValue(error);
      const block = { height: 1000 };
      const onMessage = jest.fn();
      await service.alertFor(block, onMessage);

      expect(alertMessageService.getMessage).not.toHaveBeenCalled();
      expect(onMessage).not.toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalledWith({
        event: "ALERT_FAILURE",
        alert,
        error
      });
    });
  });

  async function setup(): Promise<{
    service: DeploymentBalanceAlertsService;
    loggerService: MockProxy<LoggerService>;
    alertRepository: MockProxy<AlertRepository>;
    conditionsMatcherService: ConditionsMatcherService;
    alertMessageService: MockProxy<AlertMessageService>;
    deploymentService: MockProxy<DeploymentService>;
    onMessage: jest.Mock;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(moduleConfig)],
      providers: [
        DeploymentBalanceAlertsService,
        ConditionsMatcherService,
        TemplateService,
        MockProvider(AlertRepository),
        MockProvider(AlertMessageService),
        MockProvider(DeploymentService),
        MockProvider(LoggerService)
      ]
    }).compile();
    const onMessage = jest.fn();

    return {
      service: module.get<DeploymentBalanceAlertsService>(DeploymentBalanceAlertsService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      alertRepository: module.get<MockProxy<AlertRepository>>(AlertRepository),
      conditionsMatcherService: module.get<ConditionsMatcherService>(ConditionsMatcherService),
      alertMessageService: module.get<MockProxy<AlertMessageService>>(AlertMessageService),
      deploymentService: module.get<MockProxy<DeploymentService>>(DeploymentService),
      onMessage
    };
  }
});
