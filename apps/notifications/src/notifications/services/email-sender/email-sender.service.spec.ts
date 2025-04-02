import { Test, TestingModule } from '@nestjs/testing';
import { Novu } from '@novu/node';
import { MockProxy } from 'jest-mock-extended';

import { EmailSenderService } from './email-sender.service';

import { MockProvider } from '@test/mocks/provider.mock';

describe(EmailSenderService.name, () => {
  it('should be defined', async () => {
    const { service } = await setup();
    expect(service).toBeDefined();
  });

  describe('send', () => {
    it('should send an email', async () => {
      const { service, novu } = await setup();

      await service.send('test@test.com', 'test');

      expect(novu.trigger).toHaveBeenCalledWith('generic', {
        to: 'test@test.com',
        payload: 'test',
      });
    });
  });

  async function setup(): Promise<{
    service: EmailSenderService;
    novu: MockProxy<Novu>;
  }> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailSenderService, MockProvider(Novu)],
    }).compile();

    return {
      service: module.get<EmailSenderService>(EmailSenderService),
      novu: module.get<MockProxy<Novu>>(Novu),
    };
  }
});
