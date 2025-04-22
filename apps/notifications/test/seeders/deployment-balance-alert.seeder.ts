import { faker } from '@faker-js/faker';

import type { DeploymentBalanceAlertOutput } from '@src/alert/repositories/deployment-balance-alert/deployment-balance-alert.repository';

import { mockAkashAddress } from '@test/seeders/akash-address.seeder';

export const generateDeploymentBalanceAlert = ({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  contactPointId = faker.string.uuid(),
  template = faker.lorem.sentence(),
  conditions = {
    field: 'balance',
    value: faker.number.int({ min: 0, max: 1000000 }),
    operator: 'lt',
  },
  enabled = true,
  status = 'normal',
  dseq = faker.string.alphanumeric(6),
  owner = mockAkashAddress(),
  minBlockHeight = faker.number.int({ min: 0, max: 1000000 }),
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent(),
}: Partial<DeploymentBalanceAlertOutput>): DeploymentBalanceAlertOutput => {
  return {
    id,
    userId,
    contactPointId,
    template,
    conditions,
    enabled,
    status,
    dseq,
    owner,
    minBlockHeight,
    createdAt,
    updatedAt,
  };
};
