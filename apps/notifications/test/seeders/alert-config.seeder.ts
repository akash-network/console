import { faker } from "@faker-js/faker";

import { namespaced } from "@src/lib/namespaced/namespaced";
import type { AlertConfig } from "@src/modules/alert/config";
import { NAMESPACE } from "@src/modules/alert/config";
import type { AlertEnvConfig } from "@src/modules/alert/config/env.config";

export const generateEnvAlertConfig = (): AlertEnvConfig => ({
  API_NODE_ENDPOINT: faker.internet.url(),
  CONSOLE_WEB_URL: faker.internet.url().replace("https://", ""),
  DEPLOYMENT_BALANCE_BLOCKS_THROTTLE: faker.number.int({ min: 0, max: 10 })
});

export const generateBrokerConfig = (): AlertConfig => namespaced(NAMESPACE, generateEnvAlertConfig());
