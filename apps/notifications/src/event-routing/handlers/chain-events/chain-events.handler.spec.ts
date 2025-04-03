import { MsgCloseDeployment } from '@akashnetwork/akash-api/v1beta3';
import { generateMock } from '@anatine/zod-mock';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';
import type PgBoss from 'pg-boss';

import { BrokerService } from '@src/broker/services/broker/broker.service';
import { LoggerService } from '@src/common/services/logger.service';
import { ChainEventsController } from '@src/event-routing/controllers/chain-events/chain-events.controller';
import { MsgCloseDeploymentDto } from '@src/event-routing/dto/MsgCloseDeployment.dto';
import { ChainEventsHandler } from './chain-events.handler';

import { MockProvider } from '@test/mocks/provider.mock';

describe(ChainEventsHandler.name, () => {
  it('should be defined', async () => {
    const { handler } = await setup();
    expect(handler).toBeDefined();
  });

  it('should set the logger context in the constructor', async () => {
    const { loggerService } = await setup();
    expect(loggerService.setContext).toHaveBeenCalledWith('ChainEventsHandler');
  });

  describe('onModuleInit', () => {
    it('should subscribe to MsgCloseDeployment events with the correct parameters', async () => {
      const { handler, brokerService, chainEventsController } = await setup();

      const message = generateMock(MsgCloseDeploymentDto.schema);
      brokerService.subscribe.mockImplementation(
        async (
          eventName: string,
          options: { prefetchCount: number },
          handler: PgBoss.WorkHandler<any>,
        ) => {
          await handler([
            { data: message } as PgBoss.Job<MsgCloseDeploymentDto>,
          ]);
        },
      );

      await handler.onModuleInit();

      expect(brokerService.subscribe).toHaveBeenCalledWith(
        MsgCloseDeployment['$type'],
        { prefetchCount: 10 },
        expect.any(Function),
      );
      expect(
        chainEventsController.processDeploymentClosed,
      ).toHaveBeenCalledWith(message);
    });
  });

  async function setup(): Promise<{
    handler: ChainEventsHandler;
    brokerService: MockProxy<BrokerService>;
    chainEventsController: MockProxy<ChainEventsController>;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainEventsHandler,
        MockProvider(BrokerService),
        MockProvider(ChainEventsController),
        MockProvider(LoggerService),
      ],
    }).compile();

    return {
      handler: module.get<ChainEventsHandler>(ChainEventsHandler),
      brokerService: module.get<MockProxy<BrokerService>>(BrokerService),
      chainEventsController: module.get<MockProxy<ChainEventsController>>(
        ChainEventsController,
      ),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
    };
  }
});
