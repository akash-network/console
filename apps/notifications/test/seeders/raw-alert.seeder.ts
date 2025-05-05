import { faker } from '@faker-js/faker';

import type {
  AlertOutput,
  Conditions,
} from '@src/alert/repositories/raw-alert/raw-alert.repository';

export const generateRawAlert = ({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  contactPointId = faker.string.uuid(),
  summary = 'Default summary {{type}}',
  description = 'Default description {{type}}',
  eventConditions = {
    field: 'type',
    value: 'default',
    operator: 'eq',
  } as Conditions,
  conditions = {},
  enabled = true,
  createdAt = new Date(),
  updatedAt = new Date(),
}: Partial<AlertOutput>): AlertOutput => {
  return {
    id,
    userId,
    contactPointId,
    summary,
    description,
    eventConditions,
    conditions,
    enabled,
    createdAt,
    updatedAt,
  };
};
