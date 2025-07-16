import { generateMock } from "@anatine/zod-mock";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { BrokerService } from "@src/infrastructure/broker";
import { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import { EventClosedDeploymentDto } from "@src/modules/alert/dto/event-closed-deployment.dto";
import { ChainAlertService } from "@src/modules/alert/services/chain-alert/chain-alert.service";
import { DeploymentBalanceAlertsService } from "@src/modules/alert/services/deployment-balance-alerts/deployment-balance-alerts.service";
import { ChainEventsHandler } from "./chain-events.handler";

import { MockProvider } from "@test/mocks/provider.mock";
import { generateAlertMessage } from "@test/seeders/alert-message.seeder";

describe(ChainEventsHandler.name, () => {
  describe("processDeploymentClosed", () => {
    it("should log the received event and process alerts", async () => {
      const { controller, chainMessageAlertService, brokerService } = await setup();

      const mockEvent = generateMock(EventClosedDeploymentDto.schema);
      const alertMessage = generateAlertMessage({});
      chainMessageAlertService.alertFor.mockImplementation((_, callback) => callback(alertMessage));

      await controller.processDeploymentClosed(mockEvent);

      expect(chainMessageAlertService.alertFor).toHaveBeenCalledWith({ type: "CHAIN_EVENT", payload: mockEvent }, expect.any(Function));
      expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.createNotification, alertMessage);
    });
  });

  describe("processBlock", () => {
    it("should log the received block and process balance alerts", async () => {
      const { controller, deploymentBalanceAlertsService, brokerService } = await setup();

      const mockBlock = generateMock(ChainBlockCreatedDto.schema);
      const alertMessage = generateAlertMessage({});
      deploymentBalanceAlertsService.alertFor.mockImplementation((_, callback) => callback(alertMessage));

      await controller.processBlock(mockBlock);

      expect(deploymentBalanceAlertsService.alertFor).toHaveBeenCalledWith(mockBlock, expect.any(Function));
      expect(brokerService.publish).toHaveBeenCalledWith(eventKeyRegistry.createNotification, alertMessage);
    });
  });

  async function setup(): Promise<{
    controller: ChainEventsHandler;
    chainMessageAlertService: MockProxy<ChainAlertService>;
    deploymentBalanceAlertsService: MockProxy<DeploymentBalanceAlertsService>;
    brokerService: MockProxy<BrokerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockProvider(BrokerService), ChainEventsHandler, MockProvider(ChainAlertService), MockProvider(DeploymentBalanceAlertsService)]
    }).compile();

    return {
      controller: module.get<ChainEventsHandler>(ChainEventsHandler),
      chainMessageAlertService: module.get<MockProxy<ChainAlertService>>(ChainAlertService),
      deploymentBalanceAlertsService: module.get<MockProxy<DeploymentBalanceAlertsService>>(DeploymentBalanceAlertsService),
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService)
    };
  }
});
