import { faker } from '@faker-js/faker';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MockProxy } from 'jest-mock-extended';
import { Client } from 'pg';
import PgBoss from 'pg-boss';

import { LoggerService } from '@src/common/services/logger.service';
import { BrokerService } from './broker.service';

import { MockProvider } from '@test/mocks/provider.mock';

describe(BrokerService.name, () => {
  it('should be defined', async () => {
    const { service } = await setup();

    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should publish an event to PgBoss', async () => {
      const { service, pgBoss } = await setup();

      const eventName = faker.string.alphanumeric(10);
      const eventPayload = { data: faker.lorem.sentence() };

      await service.publish(eventName, eventPayload);

      expect(pgBoss.publish).toHaveBeenCalledWith(eventName, eventPayload);
    });
  });

  describe('subscribe', () => {
    it('should create a queue, subscribe to it, and start workers', async () => {
      const { service, pgBoss, configService } = await setup();

      const eventName = faker.string.alphanumeric(10);
      const appName = faker.company.name();
      const queueName = `${appName}.${eventName}`;
      const options = { prefetchCount: faker.number.int({ min: 1, max: 5 }) };
      const handler = jest.fn();

      configService.get.mockReturnValue(appName);

      await service.subscribe(eventName, options, handler);

      expect(configService.get).toHaveBeenCalledWith('appName');
      expect(pgBoss.createQueue).toHaveBeenCalledWith(queueName);
      expect(pgBoss.subscribe).toHaveBeenCalledWith(eventName, queueName);
      expect(pgBoss.work).toHaveBeenCalledTimes(options.prefetchCount);
      expect(pgBoss.work).toHaveBeenCalledWith(queueName, handler);
    });
  });

  describe('publishAll', () => {
    it('should publish multiple events in a transaction', async () => {
      const { service, pgBoss, pgClient } = await setup();

      const events = [
        {
          eventName: faker.string.alphanumeric(10),
          event: { data: faker.lorem.sentence() },
        },
        {
          eventName: faker.string.alphanumeric(10),
          event: { data: faker.lorem.sentence() },
        },
      ];

      await service.publishAll(events);

      expect(pgClient.query).toHaveBeenCalledWith('BEGIN');
      expect(pgBoss.publish).toHaveBeenCalledTimes(2);
      events.forEach((event) => {
        expect(pgBoss.publish).toHaveBeenCalledWith(
          event.eventName,
          event.event,
        );
      });
      expect(pgClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback the transaction if publishing fails', async () => {
      const { service, pgBoss, pgClient } = await setup();

      const events = [
        {
          eventName: faker.string.alphanumeric(10),
          event: { data: faker.lorem.sentence() },
        },
      ];

      const error = new Error(faker.lorem.sentence());
      pgBoss.publish.mockRejectedValue(error);

      await expect(service.publishAll(events)).rejects.toThrow(error.message);
      expect(pgClient.query).toHaveBeenCalledWith('BEGIN');
      expect(pgClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: BrokerService;
    pgBoss: MockProxy<PgBoss>;
    pgClient: MockProxy<Client>;
    configService: MockProxy<ConfigService>;
  }> {
    const module = await Test.createTestingModule({
      providers: [
        BrokerService,
        MockProvider(PgBoss),
        MockProvider(Client),
        MockProvider(ConfigService),
        MockProvider(LoggerService),
      ],
    }).compile();

    return {
      module,
      service: module.get<BrokerService>(BrokerService),
      pgBoss: module.get<MockProxy<PgBoss>>(PgBoss),
      pgClient: module.get<MockProxy<Client>>(Client),
      configService: module.get<MockProxy<ConfigService>>(ConfigService),
    };
  }
});
