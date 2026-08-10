import { faker } from "@faker-js/faker";
import { vi } from "vitest";

import type { ContextType as WalletProviderContextType } from "@src/context/WalletProvider/WalletProvider";

export const genWalletAddress = () => `akash${faker.string.alphanumeric({ length: 39 })}`;

export const buildWallet = (overrides: Partial<WalletProviderContextType> = {}): WalletProviderContextType => ({
  address: genWalletAddress(),
  hasWallet: true,
  signAndBroadcastTx: vi.fn(),
  denom: "uact",
  isTrialing: false,
  creditAmount: faker.number.float({ min: 0, max: 1000 }),
  topUpMinAmountUsd: 20,
  ...overrides
});
