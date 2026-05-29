import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { deleteManagedWalletFromStorage, ensureUserManagedWalletOwnership, getStorageManagedWallet, updateStorageManagedWallet } from "./walletUtils";

import { buildManagedLocalWallet } from "@tests/seeders/localWallet";

describe("walletUtils", () => {
  const MANAGED_NETWORK_ID = "sandbox";
  const USER_ID_1 = "user-123";
  const USER_ID_2 = "user-456";
  const WALLET_ADDRESS_1 = "akash1abc123";
  const WALLET_ADDRESS_2 = "akash1def456";

  describe("getStorageManagedWallet", () => {
    it("returns undefined when userId is not provided", () => {
      const { cleanup } = setup();

      expect(getStorageManagedWallet()).toBeUndefined();
      expect(getStorageManagedWallet("")).toBeUndefined();

      cleanup();
    });

    it("returns undefined when no managed wallets exist", () => {
      const { cleanup } = setup();

      expect(getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID)).toBeUndefined();

      cleanup();
    });

    it("returns managed wallet for the requested userId", () => {
      const { storage, cleanup } = setup();

      const wallet1 = buildManagedLocalWallet({
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        selected: true,
        creditAmount: 100,
        isTrialing: false,
        token: "token-cert1"
      });
      const wallet2 = buildManagedLocalWallet({
        address: WALLET_ADDRESS_2,
        userId: USER_ID_2,
        selected: false,
        creditAmount: 200,
        isTrialing: true
      });

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify({ [USER_ID_1]: wallet1, [USER_ID_2]: wallet2 }));

      expect(getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID)?.address).toBe(WALLET_ADDRESS_1);
      expect(getStorageManagedWallet(USER_ID_2, MANAGED_NETWORK_ID)?.address).toBe(WALLET_ADDRESS_2);

      cleanup();
    });

    it("returns undefined for non-existent userId", () => {
      const { storage, cleanup } = setup();

      const managedWallet = buildManagedLocalWallet({ address: WALLET_ADDRESS_1, userId: USER_ID_1, selected: true });
      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify({ [USER_ID_1]: managedWallet }));

      expect(getStorageManagedWallet("non-existent-user", MANAGED_NETWORK_ID)).toBeUndefined();

      cleanup();
    });

    it("handles corrupt JSON gracefully", () => {
      const { storage, cleanup } = setup();

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, "invalid-json");

      expect(getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID)).toBeUndefined();

      cleanup();
    });
  });

  describe("updateStorageManagedWallet", () => {
    it("creates a new managed wallet entry", () => {
      const { cleanup } = setup();

      const wallet = buildManagedLocalWallet({
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false,
        selected: true
      });

      const result = updateStorageManagedWallet(wallet);

      expect(result?.name).toBe("Managed Wallet");
      expect(result?.isManaged).toBe(true);
      expect(result?.address).toBe(WALLET_ADDRESS_1);
      expect(result?.selected).toBe(true);

      const stored = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      expect(stored).toEqual(result);

      cleanup();
    });

    it("merges partial updates with the existing entry", () => {
      const { cleanup } = setup();

      updateStorageManagedWallet(
        buildManagedLocalWallet({ address: WALLET_ADDRESS_1, userId: USER_ID_1, creditAmount: 100, isTrialing: false, token: "token-cert1" })
      );

      const result = updateStorageManagedWallet({ userId: USER_ID_1, token: "token-cert2" });

      expect(result?.token).toBe("token-cert2");
      expect(result?.address).toBe(WALLET_ADDRESS_1);
      expect(result?.creditAmount).toBe(100);

      cleanup();
    });

    it("returns undefined when no prior entry and required fields missing", () => {
      const { cleanup } = setup();

      const result = updateStorageManagedWallet({ userId: USER_ID_1, token: "token-cert2" });
      expect(result).toBeUndefined();

      cleanup();
    });

    it("preserves other users' entries (multi-user isolation)", () => {
      const { cleanup } = setup();

      const user1Wallet = buildManagedLocalWallet({ address: WALLET_ADDRESS_1, userId: USER_ID_1, creditAmount: 100, isTrialing: false });
      const user2Wallet = buildManagedLocalWallet({ address: WALLET_ADDRESS_2, userId: USER_ID_2, creditAmount: 200, isTrialing: true });

      updateStorageManagedWallet(user1Wallet);
      updateStorageManagedWallet(user2Wallet);

      updateStorageManagedWallet({ ...user1Wallet, creditAmount: 300 });

      expect(getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID)?.creditAmount).toBe(300);
      expect(getStorageManagedWallet(USER_ID_2, MANAGED_NETWORK_ID)?.creditAmount).toBe(200);

      cleanup();
    });

    it("preserves selected flag from previous entry when omitted", () => {
      const { cleanup } = setup();

      updateStorageManagedWallet(
        buildManagedLocalWallet({ address: WALLET_ADDRESS_1, userId: USER_ID_1, creditAmount: 100, isTrialing: false, selected: true })
      );

      const result = updateStorageManagedWallet({ userId: USER_ID_1, creditAmount: 200 });
      expect(result?.selected).toBe(true);

      cleanup();
    });
  });

  describe("deleteManagedWalletFromStorage", () => {
    it("removes managed wallet for the requested user", () => {
      const { storage, cleanup } = setup();

      storage.set(
        `${MANAGED_NETWORK_ID}/managed-wallets`,
        JSON.stringify({
          [USER_ID_1]: buildManagedLocalWallet({ address: WALLET_ADDRESS_1, userId: USER_ID_1, selected: true, creditAmount: 100, isTrialing: false }),
          [USER_ID_2]: buildManagedLocalWallet({ address: WALLET_ADDRESS_2, userId: USER_ID_2, selected: false, creditAmount: 200, isTrialing: true })
        })
      );
      storage.set(`${MANAGED_NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/123`, "{}");

      deleteManagedWalletFromStorage(USER_ID_1, MANAGED_NETWORK_ID);

      const remaining = JSON.parse(storage.get(`${MANAGED_NETWORK_ID}/managed-wallets`)!);
      expect(remaining[USER_ID_1]).toBeUndefined();
      expect(remaining[USER_ID_2]).toBeDefined();
      expect(storage.get(`${MANAGED_NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/123`)).toBeUndefined();

      cleanup();
    });

    it("removes the managed-wallets key when the last entry is deleted", () => {
      const { storage, cleanup } = setup();

      storage.set(
        `${MANAGED_NETWORK_ID}/managed-wallets`,
        JSON.stringify({
          [USER_ID_1]: buildManagedLocalWallet({ address: WALLET_ADDRESS_1, userId: USER_ID_1, selected: true, creditAmount: 100, isTrialing: false })
        })
      );

      deleteManagedWalletFromStorage(USER_ID_1, MANAGED_NETWORK_ID);

      expect(storage.get(`${MANAGED_NETWORK_ID}/managed-wallets`)).toBeUndefined();

      cleanup();
    });

    it("does nothing when userId is empty", () => {
      const { storage, cleanup } = setup();

      storage.set(
        `${MANAGED_NETWORK_ID}/managed-wallets`,
        JSON.stringify({
          [USER_ID_1]: buildManagedLocalWallet({ address: WALLET_ADDRESS_1, userId: USER_ID_1, selected: true, creditAmount: 100, isTrialing: false })
        })
      );

      deleteManagedWalletFromStorage("", MANAGED_NETWORK_ID);

      expect(storage.get(`${MANAGED_NETWORK_ID}/managed-wallets`)).toBeDefined();

      cleanup();
    });

    it("does nothing when the wallet doesn't exist", () => {
      const { cleanup } = setup();

      deleteManagedWalletFromStorage("non-existent-user", MANAGED_NETWORK_ID);

      cleanup();
    });
  });

  describe("ensureUserManagedWalletOwnership", () => {
    it("marks the user's managed wallet as selected when it is not", () => {
      const { cleanup } = setup();

      updateStorageManagedWallet(
        buildManagedLocalWallet({ address: WALLET_ADDRESS_1, userId: USER_ID_1, selected: false, creditAmount: 100, isTrialing: false })
      );

      ensureUserManagedWalletOwnership(USER_ID_1);

      expect(getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID)?.selected).toBe(true);

      cleanup();
    });

    it("is a no-op when the wallet doesn't exist", () => {
      const { cleanup } = setup();

      ensureUserManagedWalletOwnership("non-existent-user");

      expect(getStorageManagedWallet("non-existent-user", MANAGED_NETWORK_ID)).toBeUndefined();

      cleanup();
    });
  });

  function setup() {
    const storage = new Map<string, string>();

    const mockLocalStorage = mock<Storage>({
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
      key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
      length: 0
    });

    Object.defineProperty(mockLocalStorage, "length", {
      get: () => storage.size,
      enumerable: true,
      configurable: true
    });

    const originalLocalStorage = global.localStorage;

    const localStorageProxy = new Proxy(mockLocalStorage, {
      ownKeys: () => Array.from(storage.keys()),
      getOwnPropertyDescriptor: (_target, key) => {
        if (storage.has(key as string)) {
          return { enumerable: true, configurable: true, value: storage.get(key as string) };
        }
        return undefined;
      }
    });

    Object.defineProperty(global, "localStorage", {
      value: localStorageProxy,
      writable: true,
      configurable: true
    });

    Object.defineProperty(browserEnvConfig, "NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID", {
      value: MANAGED_NETWORK_ID,
      writable: true,
      configurable: true
    });

    return {
      storage,
      cleanup: () => {
        Object.defineProperty(global, "localStorage", {
          value: originalLocalStorage,
          writable: true,
          configurable: true
        });
      }
    };
  }
});
