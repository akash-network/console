import { faker } from "@faker-js/faker";

import type { UserWalletOutput, WalletInitialized } from "@src/billing/repositories";
import { createAkashAddress } from "./akash-address.seeder";

export function createUserWallet({
  id = faker.number.int({ min: 0, max: 1000 }),
  userId = faker.string.uuid(),
  organizationId = null,
  createdByUserId = null,
  address = createAkashAddress(),
  deploymentAllowance = faker.number.float({ min: 0, max: 1000000 }),
  feeAllowance = faker.number.float({ min: 0, max: 1000000 }),
  isTrialing = faker.helpers.arrayElement([true, false]),
  createdAt = faker.date.past(),
  updatedAt = faker.date.past(),
  activatedAt = createdAt,
  creditsLowNotifiedAt = null,
  creditsSufficientSince = null,
  creditsLowSince = null,
  creditsExhaustedNotifiedAt = null,
  abuseLockedAt = null,
  abuseLockedReason = null
}: Partial<UserWalletOutput> & { userId?: string } = {}): UserWalletOutput & { userId: string } {
  return {
    id,
    userId,
    organizationId,
    createdByUserId,
    address,
    deploymentAllowance,
    feeAllowance,
    isTrialing,
    creditAmount: deploymentAllowance,
    createdAt,
    updatedAt,
    activatedAt,
    creditsLowNotifiedAt,
    creditsSufficientSince,
    creditsLowSince,
    creditsExhaustedNotifiedAt,
    abuseLockedAt,
    abuseLockedReason
  };
}

export function createInitializedUserWallet({
  address = createAkashAddress(),
  ...input
}: Partial<UserWalletOutput> & { userId?: string; address?: string } = {}): WalletInitialized & { userId: string } {
  return { ...createUserWallet(input), address };
}

export function createOrganizationWallet({
  organizationId = faker.string.uuid(),
  ...input
}: Partial<Omit<UserWalletOutput, "userId">> & { address?: string } = {}): WalletInitialized {
  return {
    ...createInitializedUserWallet({ ...input, organizationId, isTrialing: false }),
    userId: null,
    createdByUserId: input.createdByUserId ?? faker.string.uuid()
  };
}
