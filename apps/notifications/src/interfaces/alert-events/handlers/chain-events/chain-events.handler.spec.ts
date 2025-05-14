import { generateMock } from "@anatine/zod-mock";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";

import { BrokerService } from "@src/infrastructure/broker";
import { ChainBlockCreatedDto } from "@src/modules/alert/dto/chain-block-created.dto";
import { MsgCloseDeploymentDto } from "@src/modules/alert/dto/msg-close-deployment.dto";
import { DeploymentBalanceAlertsService } from "@src/modules/alert/services/deployment-balance-alerts/deployment-balance-alerts.service";
import { RawAlertsService } from "@src/modules/alert/services/raw-alerts/raw-alerts.service";
import { ChainEventsHandler } from "./chain-events.handler";

import { MockProvider } from "@test/mocks/provider.mock";
import { generateAlertMessage } from "@test/seeders/alert-message.seeder";

describe(ChainEventsHandler.name, () => {
  describe("processDeploymentClosed", () => {
    it("should log the received event and process alerts", async () => {
      const { controller, rawAlertsService, brokerService } = await setup();

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);
      const alertMessage = generateAlertMessage({});
      rawAlertsService.alertFor.mockImplementation((_, callback) => callback(alertMessage));

      await controller.processDeploymentClosed(mockEvent);

      expect(rawAlertsService.alertFor).toHaveBeenCalledWith(mockEvent, expect.any(Function));
      expect(brokerService.publish).toHaveBeenCalledWith("notifications.v1.notification.send", alertMessage);
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
      expect(brokerService.publish).toHaveBeenCalledWith("notifications.v1.notification.send", alertMessage);
    });
  });

  async function setup(): Promise<{
    controller: ChainEventsHandler;
    rawAlertsService: MockProxy<RawAlertsService>;
    deploymentBalanceAlertsService: MockProxy<DeploymentBalanceAlertsService>;
    brokerService: MockProxy<BrokerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockProvider(BrokerService), ChainEventsHandler, MockProvider(RawAlertsService), MockProvider(DeploymentBalanceAlertsService)]
    }).compile();

    return {
      controller: module.get<ChainEventsHandler>(ChainEventsHandler),
      rawAlertsService: module.get<MockProxy<RawAlertsService>>(RawAlertsService),
      deploymentBalanceAlertsService: module.get<MockProxy<DeploymentBalanceAlertsService>>(DeploymentBalanceAlertsService),
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService)
    };
  }
});
