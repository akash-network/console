import { generateMock } from '@anatine/zod-mock';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { MockProxy } from 'jest-mock-extended';

import { RawAlertRepository } from '@src/modules/alert/repositories/raw-alert/raw-alert.repository';
import {
  AlertController,
  alertCreateInputSchema,
  alertCreateOutputSchema,
} from './alert.controller';

import { MockProvider } from '@test/mocks/provider.mock';

describe(AlertController.name, () => {
  describe('createAlert', () => {
    it('should call rawAlertRepository.create() and return the created alert', async () => {
      const { controller, rawAlertRepository } = await setup();

      const input = generateMock(alertCreateInputSchema);
      const output = generateMock(alertCreateOutputSchema);

      rawAlertRepository.create.mockResolvedValue(output);

      const result = await controller.createAlert({ data: input });

      expect(rawAlertRepository.create).toHaveBeenCalledWith(input);
      expect(result).toEqual({ data: output });
    });
  });

  async function setup(): Promise<{
    controller: AlertController;
    rawAlertRepository: MockProxy<RawAlertRepository>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertController],
      providers: [MockProvider(RawAlertRepository)],
    }).compile();

    return {
      controller: module.get(AlertController),
      rawAlertRepository: module.get(RawAlertRepository),
    };
  }
});
