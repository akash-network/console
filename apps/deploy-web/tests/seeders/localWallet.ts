import { faker } from "@faker-js/faker";

import type { ManagedLocalWallet } from "@src/utils/walletUtils";
import { genWalletAddress } from "./wallet";

export const buildManagedLocalWallet = (overrides: Partial<ManagedLocalWallet> = {}): ManagedLocalWallet => ({
  name: "Managed Wallet",
  address: genWalletAddress(),
  userId: faker.string.uuid(),
  selected: faker.datatype.boolean(),
  isManaged: true,
  creditAmount: faker.number.int({ min: 0, max: 1000 }),
  isTrialing: faker.datatype.boolean(),
  ...overrides
});
