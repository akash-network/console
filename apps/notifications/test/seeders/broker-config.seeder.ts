import { faker } from "@faker-js/faker";

import type { BrokerConfig } from "@src/infrastructure/broker/config";
import { NAMESPACE } from "@src/infrastructure/broker/config";
import type { BrokerEnvConfig } from "@src/infrastructure/broker/config/env.config";
import { namespaced } from "@src/lib/namespaced/namespaced";

export const generateEnvBrokerConfig = (): BrokerEnvConfig => ({
  APP_NAME: faker.lorem.word(),
  EVENT_BROKER_POSTGRES_URI: `postgres://user:password@localhost:5432/${faker.lorem.word()}`
});

export const generateBrokerConfig = (): BrokerConfig => namespaced(NAMESPACE, generateEnvBrokerConfig());
