import { faker } from "@faker-js/faker";
import { ConfigModule, ConfigService, registerAs } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { Client } from "pg";
import PgBoss from "pg-boss";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { BrokerConfig } from "@src/infrastructure/broker/config";
import { NAMESPACE } from "@src/infrastructure/broker/config";
import { BrokerService } from "./broker.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { generateEnvBrokerConfig } from "@test/seeders/broker-config.seeder";

describe(BrokerService.name, () => {
  it("should be defined", async () => {
    const { service } = await setup();

    expect(service).toBeDefined();
  });

  describe("publish", () => {
    it("should publish an event to PgBoss", async () => {
      const { service, pgBoss } = await setup();

      const eventName = faker.string.alphanumeric(10);
      const eventPayload = { data: faker.lorem.sentence() };

      await service.publish(eventName, eventPayload);

      expect(pgBoss.publish).toHaveBeenCalledWith(eventName, eventPayload);
    });
  });

  describe("subscribe", () => {
    it("should create a queue, subscribe to it, and start workers", async () => {
      const { service, pgBoss, configService } = await setup();

      const eventName = faker.string.alphanumeric(10);
      const queueName = `${configService.getOrThrow("broker.APP_NAME")}.${eventName}`;
      const options = { prefetchCount: faker.number.int({ min: 1, max: 5 }) };
      const handler = jest.fn();

      await service.subscribe(eventName, options, handler);

      expect(pgBoss.createQueue).toHaveBeenCalledWith(queueName);
      expect(pgBoss.subscribe).toHaveBeenCalledWith(eventName, queueName);
      expect(pgBoss.work).toHaveBeenCalledTimes(options.prefetchCount);
      expect(pgBoss.work).toHaveBeenCalledWith(queueName, expect.any(Function));
    });
  });

  describe("publishAll", () => {
    it("should publish multiple events in a transaction", async () => {
      const { service, pgBoss, pgClient } = await setup();

      const events = [
        {
          eventName: faker.string.alphanumeric(10),
          event: { data: faker.lorem.sentence() }
        },
        {
          eventName: faker.string.alphanumeric(10),
          event: { data: faker.lorem.sentence() }
        }
      ];

      await service.publishAll(events);

      expect(pgClient.query).toHaveBeenCalledWith("BEGIN");
      expect(pgBoss.publish).toHaveBeenCalledTimes(2);
      events.forEach(event => {
        expect(pgBoss.publish).toHaveBeenCalledWith(event.eventName, event.event);
      });
      expect(pgClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("should rollback the transaction if publishing fails", async () => {
      const { service, pgBoss, pgClient } = await setup();

      const events = [
        {
          eventName: faker.string.alphanumeric(10),
          event: { data: faker.lorem.sentence() }
        }
      ];

      const error = new Error(faker.lorem.sentence());
      pgBoss.publish.mockRejectedValue(error);

      await expect(service.publishAll(events)).rejects.toThrow(error.message);
      expect(pgClient.query).toHaveBeenCalledWith("BEGIN");
      expect(pgClient.query).toHaveBeenCalledWith("ROLLBACK");
    });
  });

  async function setup(): Promise<{
    module: TestingModule;
    service: BrokerService;
    pgBoss: MockProxy<PgBoss>;
    pgClient: MockProxy<Client>;
    configService: ConfigService<BrokerConfig>;
  }> {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(registerAs(NAMESPACE, () => generateEnvBrokerConfig()))],
      providers: [BrokerService, MockProvider(PgBoss), MockProvider(Client), MockProvider(LoggerService)]
    }).compile();

    return {
      module,
      service: module.get<BrokerService>(BrokerService),
      pgBoss: module.get<MockProxy<PgBoss>>(PgBoss),
      pgClient: module.get<MockProxy<Client>>(Client),
      configService: module.get(ConfigService)
    };
  }
});
