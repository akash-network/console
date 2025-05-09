import { generateMock } from '@anatine/zod-mock';
import { faker } from '@faker-js/faker';

import type { ContactPointOutput } from '@src/modules/notifications/repositories/contact-point/contact-point.repository';
import { contactPointConfigSchema } from '@src/modules/notifications/repositories/contact-point/contact-point.repository';

export const generateContactPoint = ({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  type = faker.helpers.arrayElement<ContactPointOutput['type']>(['email']),
  config = generateMock(contactPointConfigSchema),
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
