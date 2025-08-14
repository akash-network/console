import { faker } from "@faker-js/faker";

import type { ContextType as WalletProviderContextType } from "@src/context/WalletProvider/WalletProvider";

export const genWalletAddress = () => `akash${faker.string.alphanumeric({ length: 39 })}`;

export const buildWallet = (overrides: Partial<WalletProviderContextType> = {}): WalletProviderContextType => ({
  address: genWalletAddress(),
  walletName: faker.internet.username(),
  isWalletConnected: true,
  isWalletLoaded: true,
  connectManagedWallet: jest.fn(),
  logout: jest.fn(),
  signAndBroadcastTx: jest.fn(),
  isManaged: true,
  isCustodial: false,
  isWalletLoading: false,
  isTrialing: false,
  isOnboarding: false,
  creditAmount: faker.number.float({ min: 0, max: 1000 }),
  switchWalletType: jest.fn(),
  hasManagedWallet: true,
  managedWalletError: undefined,
  ...overrides
});
