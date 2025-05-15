import { faker } from "@faker-js/faker";

import type { DeploymentBalanceAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";

export const generateDeploymentBalanceAlert = ({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  contactPointId = faker.string.uuid(),
  summary = faker.lorem.sentence(),
  description = faker.lorem.sentence(),
  conditions = {
    field: "balance",
    value: faker.number.int({ min: 0, max: 1000000 }),
    operator: "lt"
  },
  enabled = true,
  status = "NORMAL",
  params = {
    dseq: faker.string.alphanumeric(6),
    owner: mockAkashAddress()
  },
  minBlockHeight = faker.number.int({ min: 0, max: 1000000 }),
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<DeploymentBalanceAlertOutput>): DeploymentBalanceAlertOutput => {
  return {
    type: "DEPLOYMENT_BALANCE",
    id,
    userId,
    contactPointId,
    summary,
    description,
    conditions,
    enabled,
    status,
    params,
    minBlockHeight,
    createdAt,
    updatedAt
  };
};
