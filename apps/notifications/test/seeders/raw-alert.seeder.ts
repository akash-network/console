import { faker } from '@faker-js/faker';

import type {
  AlertOutput,
  Conditions,
} from '@src/modules/alert/repositories/raw-alert/raw-alert.repository';

export const generateRawAlert = ({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  contactPointId = faker.string.uuid(),
  summary = 'Default summary {{type}}',
  description = 'Default description {{type}}',
  conditions = {
    field: 'type',
    value: 'default',
    operator: 'eq',
  } as Conditions,
  enabled = true,
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent(),
}: Partial<AlertOutput>): AlertOutput => {
  return {
    id,
    userId,
    contactPointId,
    summary,
    description,
    conditions,
    enabled,
    createdAt,
    updatedAt,
  };
};
