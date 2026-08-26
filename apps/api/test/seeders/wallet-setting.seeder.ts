import { faker } from "@faker-js/faker";

import type { WalletSettingOutput } from "@src/billing/repositories";

export const generateWalletSetting = (overrides: Partial<WalletSettingOutput>) => {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    walletId: faker.number.int({ min: 1, max: 1000 }),
    autoReloadEnabled: faker.datatype.boolean(),
    autoReloadMode: "prediction" as const,
    autoReloadThreshold: faker.number.int({ min: 500, max: 100000 }),
    autoReloadAmount: faker.number.int({ min: 2000, max: 100000 }),
    lastAutoChargeAt: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    ...overrides
  };
};
