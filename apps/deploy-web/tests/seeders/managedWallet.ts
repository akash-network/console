import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

export const buildManagedWallet = (overrides: Partial<ApiManagedWalletOutput> = {}): ApiManagedWalletOutput => ({
  id: faker.string.uuid(),
  userId: faker.string.uuid(),
  address: `akash${faker.string.alphanumeric({ length: 39 })}`,
  isTrialing: faker.datatype.boolean(),
  creditAmount: faker.number.int({ min: 0, max: 1000 }),
  username: "Managed Wallet" as const,
  isWalletConnected: true,
  ...overrides
});
