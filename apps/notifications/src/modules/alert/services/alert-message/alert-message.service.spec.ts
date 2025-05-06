import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { TemplateService } from '@src/modules/alert/services/template/template.service';
import { AlertMessageService } from './alert-message.service';

describe(AlertMessageService.name, () => {
  const vars = { usage: 90, server: 'node-1' };

  describe('send', () => {
    it('should return an alert payload with prefix', async () => {
      const { service } = await setup();

      expect(
        service.getMessage({
          summary: 'CPU usage: {{usage}}%',
          description: 'Server {{server}} has high CPU load.',
          vars,
          summaryPrefix: 'FIRING',
        }),
      ).toEqual({
        summary: '[FIRING] CPU usage: 90%',
        description: 'Server node-1 has high CPU load.',
      });
    });

    it('should an alert payload  without prefix', async () => {
      const { service } = await setup();

      expect(
        service.getMessage({
          summary: 'CPU usage: {{usage}}%',
          description: 'Server {{server}} has high CPU load.',
          vars,
        }),
      ).toEqual({
        summary: 'CPU usage: 90%',
        description: 'Server node-1 has high CPU load.',
      });
    });
  });

  async function setup(): Promise<{
    service: AlertMessageService;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertMessageService, TemplateService],
    }).compile();

    return {
      service: module.get(AlertMessageService),
    };
  }
});
