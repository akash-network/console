import { faker } from "@faker-js/faker";

import type { WalletBalanceAlertOutput } from "@src/modules/alert/repositories/alert/alert.repository";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";

export const generateWalletBalanceAlert = ({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  notificationChannelId = faker.string.uuid(),
  name = faker.lorem.word(),
  summary = faker.lorem.sentence(),
  description = faker.lorem.sentence(),
  conditions = {
    field: "balance",
    value: faker.number.int({ min: 0, max: 1000000 }),
    operator: "lt"
  },
  enabled = true,
  status = "OK",
  params = {
    owner: mockAkashAddress(),
    denom: "uakt"
  },
  minBlockHeight = faker.number.int({ min: 0, max: 1000000 }),
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<WalletBalanceAlertOutput>): WalletBalanceAlertOutput => {
  return {
    type: "WALLET_BALANCE",
    id,
    userId,
    notificationChannelId,
    name,
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
