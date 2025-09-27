import { faker } from "@faker-js/faker";

import type { WalletBalance } from "@src/hooks/useWalletBalance";

export const buildWalletBalance = (overrides: Partial<WalletBalance> = {}): WalletBalance => ({
  totalUsd: faker.number.float({ min: 0, max: 10000, fractionDigits: 2 }),
  balanceUAKT: faker.number.int({ min: 0, max: 1000000 }),
  balanceUUSDC: faker.number.int({ min: 0, max: 1000000 }),
  totalUAKT: faker.number.int({ min: 0, max: 1000000 }),
  totalUUSDC: faker.number.int({ min: 0, max: 1000000 }),
  totalDeploymentEscrowUAKT: faker.number.int({ min: 0, max: 100000 }),
  totalDeploymentEscrowUUSDC: faker.number.int({ min: 0, max: 100000 }),
  totalDeploymentEscrowUSD: faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
  totalDeploymentGrantsUAKT: faker.number.int({ min: 0, max: 100000 }),
  totalDeploymentGrantsUUSDC: faker.number.int({ min: 0, max: 100000 }),
  totalDeploymentGrantsUSD: faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
  ...overrides
});
