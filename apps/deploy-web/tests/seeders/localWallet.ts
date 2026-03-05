import { faker } from "@faker-js/faker";

import type { LocalWallet } from "@src/utils/walletUtils";
import { genWalletAddress } from "./wallet";

type ManagedLocalWallet = Extract<LocalWallet, { isManaged: true }>;
type CustodialLocalWallet = Extract<LocalWallet, { isManaged: false }>;

export const buildManagedLocalWallet = (overrides: Partial<ManagedLocalWallet> = {}): ManagedLocalWallet => ({
  name: "Managed Wallet",
  address: genWalletAddress(),
  userId: faker.string.uuid(),
  selected: faker.datatype.boolean(),
  isManaged: true,
  creditAmount: faker.number.int({ min: 0, max: 1000 }),
  isTrialing: faker.datatype.boolean(),
  cert: faker.string.alphanumeric(64),
  certKey: faker.string.alphanumeric(64),
  ...overrides
});

export const buildCustodialLocalWallet = (overrides: Partial<CustodialLocalWallet> = {}): CustodialLocalWallet => ({
  name: faker.internet.username(),
  address: genWalletAddress(),
  selected: faker.datatype.boolean(),
  isManaged: false,
  cert: faker.string.alphanumeric(64),
  certKey: faker.string.alphanumeric(64),
  ...overrides
});
