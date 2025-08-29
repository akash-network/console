import { faker } from "@faker-js/faker";
import merge from "lodash/merge";

import type { ServiceType } from "@src/types";

export const buildSDLService = (overrides: Partial<ServiceType> = {}): ServiceType =>
  merge(
    {
      id: faker.string.uuid(),
      title: faker.lorem.word(),
      image: faker.helpers.arrayElement(["nginx:latest", "node:18-alpine", "postgres:15", "redis:7-alpine", "python:3.11-slim"]),
      placement: {
        name: faker.helpers.arrayElement(["default", "dcloud", "mainnet"]),
        pricing: {
          amount: faker.number.int({ min: 100, max: 10000 }),
          denom: faker.helpers.arrayElement(["uakt", "uakt"])
        },
        signedBy: {
          anyOf: [],
          allOf: []
        },
        attributes: []
      },
      profile: {
        cpu: faker.number.float({ min: 0.1, max: 8, fractionDigits: 1 }),
        ram: faker.number.int({ min: 256, max: 8192 }),
        ramUnit: faker.helpers.arrayElement(["Mi", "Gi"]),
        storage: [
          {
            size: faker.number.int({ min: 1, max: 100 }),
            unit: faker.helpers.arrayElement(["Mi", "Gi"]),
            isPersistent: faker.datatype.boolean()
          }
        ],
        hasGpu: faker.datatype.boolean(),
        gpu: faker.number.int({ min: 0, max: 8 })
      },
      expose: [],
      count: faker.number.int({ min: 1, max: 5 })
    },
    overrides
  );
