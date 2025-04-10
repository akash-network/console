import { generateMock } from '@anatine/zod-mock';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { ChainBlockCreatedDto } from '@src/alert/dto/chain-block-created.dto';
import { MsgCloseDeploymentDto } from '@src/alert/dto/msg-close-deployment.dto';
import { DeploymentBalanceAlertsService } from '@src/alert/services/deployment-balance-alerts/deployment-balance-alerts.service';
import { RawAlertsService } from '@src/alert/services/raw-alerts/raw-alerts.service';
import { LoggerService } from '@src/common/services/logger.service';
import { ChainEventsController } from './chain-events.controller';

import { MockProvider } from '@test/mocks/provider.mock';

describe(ChainEventsController.name, () => {
  describe('processDeploymentClosed', () => {
    it('should log the received event and process alerts', async () => {
      const { controller, rawAlertsService, loggerService } = await setup();

      const mockEvent = generateMock(MsgCloseDeploymentDto.schema);

      await controller.processDeploymentClosed(mockEvent);

      expect(loggerService.log).toHaveBeenCalledWith(
        'received MsgCloseDeployment',
        mockEvent,
      );
      expect(rawAlertsService.alertFor).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe('processBlock', () => {
    it('should log the received block and process balance alerts', async () => {
      const { controller, deploymentBalanceAlertsService, loggerService } =
        await setup();

      const mockBlock = generateMock(ChainBlockCreatedDto.schema);

      await controller.processBlock(mockBlock);

      expect(loggerService.log).toHaveBeenCalledWith(
        'received MsgCloseDeployment',
        mockBlock,
      );
      expect(deploymentBalanceAlertsService.alertFor).toHaveBeenCalledWith(
        mockBlock,
      );
    });
  });

  async function setup(): Promise<{
    controller: ChainEventsController;
    rawAlertsService: MockProxy<RawAlertsService>;
    deploymentBalanceAlertsService: MockProxy<DeploymentBalanceAlertsService>;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainEventsController,
        MockProvider(RawAlertsService),
        MockProvider(DeploymentBalanceAlertsService),
        MockProvider(LoggerService),
      ],
    }).compile();

    return {
      controller: module.get<ChainEventsController>(ChainEventsController),
      rawAlertsService:
        module.get<MockProxy<RawAlertsService>>(RawAlertsService),
      deploymentBalanceAlertsService: module.get<
        MockProxy<DeploymentBalanceAlertsService>
      >(DeploymentBalanceAlertsService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
    };
  }
});
