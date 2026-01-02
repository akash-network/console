import { faker } from "@faker-js/faker";

import type { WalletSettingOutput } from "@src/billing/repositories";

export const generateWalletSetting = (overrides: Partial<WalletSettingOutput>) => {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    walletId: faker.number.int({ min: 1, max: 1000 }),
    autoReloadEnabled: faker.datatype.boolean(),
    autoReloadThreshold: faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
    autoReloadAmount: faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    ...overrides
  };
};
