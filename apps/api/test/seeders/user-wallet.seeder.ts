import { faker } from "@faker-js/faker";

import type { UserWalletOutput, WalletInitialized } from "@src/billing/repositories";
import { createAkashAddress } from "./akash-address.seeder";

export function createUserWallet({
  id = faker.number.int({ min: 0, max: 1000 }),
  userId = faker.string.uuid(),
  address = createAkashAddress(),
  deploymentAllowance = faker.number.float({ min: 0, max: 1000000 }),
  feeAllowance = faker.number.float({ min: 0, max: 1000000 }),
  isTrialing = faker.helpers.arrayElement([true, false]),
  createdAt = faker.date.past(),
  updatedAt = faker.date.past(),
  activatedAt = createdAt,
  creditsLowNotifiedAt = null,
  creditsSufficientSince = null
}: Partial<UserWalletOutput> = {}): UserWalletOutput {
  return {
    id,
    userId,
    address,
    deploymentAllowance,
    feeAllowance,
    isTrialing,
    creditAmount: deploymentAllowance,
    createdAt,
    updatedAt,
    activatedAt,
    creditsLowNotifiedAt,
    creditsSufficientSince
  };
}

export function createInitializedUserWallet({
  address = createAkashAddress(),
  ...input
}: Partial<UserWalletOutput> & { address?: string } = {}): WalletInitialized {
  return { ...createUserWallet(input), address };
}
