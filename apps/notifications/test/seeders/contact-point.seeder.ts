import { faker } from '@faker-js/faker';

import type { ContactPoint } from '@src/alert/model-schemas';

type ContactPointOutput = typeof ContactPoint.$inferSelect;

export const generateContactPoint = ({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  type = faker.helpers.arrayElement<ContactPointOutput['type']>(['email']),
  config = {},
  createdAt = new Date(),
  updatedAt = new Date(),
}: Partial<ContactPointOutput>): ContactPointOutput => {
  return {
    id,
    userId,
    type,
    config,
    createdAt,
    updatedAt,
  };
};
