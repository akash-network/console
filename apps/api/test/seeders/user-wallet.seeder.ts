import { faker } from "@faker-js/faker";

import type { UserWalletOutput } from "@src/billing/repositories";
import { createAkashAddress } from "./akash-address.seeder";

export class UserWalletSeeder {
  static create({
    id = faker.number.int({ min: 0, max: 1000 }),
    userId = faker.string.uuid(),
    address = createAkashAddress(),
    deploymentAllowance = faker.number.float({ min: 0, max: 1000000 }),
    feeAllowance = faker.number.float({ min: 0, max: 1000000 }),
    isTrialing = faker.helpers.arrayElement([true, false]),
    createdAt = faker.date.past(),
    updatedAt = faker.date.past()
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
      isOldWallet: false
    };
  }
}
