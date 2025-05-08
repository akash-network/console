import { faker } from '@faker-js/faker';

import type { BrokerModuleConfig } from '@src/infrastructure/broker/broker-module.definition';

export const generateBrokerConfig = (): BrokerModuleConfig => ({
  appName: faker.lorem.word(),
  postgresUri: `postgres://user:password@localhost:5432/${faker.lorem.word()}`,
});
