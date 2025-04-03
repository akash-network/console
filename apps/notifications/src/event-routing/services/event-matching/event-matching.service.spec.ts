import { generateMock } from '@anatine/zod-mock';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { LoggerService } from '@src/common/services/logger.service';
import { MsgCloseDeploymentDto } from '@src/event-routing/dto/MsgCloseDeployment.dto';
import { EventMatchingService } from './event-matching.service';

import { MockProvider } from '@test/mocks/provider.mock';

describe(EventMatchingService.name, () => {
  it('should be defined', async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe('match', () => {
    it('should match an event', async () => {
      const { service } = await setup();

      const event = generateMock(MsgCloseDeploymentDto.schema);
      const result = service.match(event);
      expect(result).toBeDefined();
    });
  });

  async function setup(): Promise<{
    service: EventMatchingService;
    loggerService: MockProxy<LoggerService>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventMatchingService, MockProvider(LoggerService)],
    }).compile();

    return {
      service: module.get<EventMatchingService>(EventMatchingService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
    };
  }
});
