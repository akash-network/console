import { mock } from "jest-mock-extended";

import { browserEnvConfig } from "@src/config/browser-env.config";
import networkStore from "@src/store/networkStore";
import type { LocalWallet } from "./walletUtils";
import {
  deleteManagedWalletFromStorage,
  deleteWalletFromStorage,
  ensureUserManagedWalletOwnership,
  getSelectedStorageWallet,
  getStorageManagedWallet,
  getStorageWallets,
  updateStorageManagedWallet,
  updateStorageWallets,
  updateWallet
} from "./walletUtils";

describe("walletUtils", () => {
  const NETWORK_ID = "mainnet";
  const MANAGED_NETWORK_ID = "sandbox";
  const USER_ID_1 = "user-123";
  const USER_ID_2 = "user-456";
  const WALLET_ADDRESS_1 = "akash1abc123";
  const WALLET_ADDRESS_2 = "akash1def456";
  const WALLET_ADDRESS_3 = "akash1ghi789";

  describe("getStorageWallets", () => {
    it("returns empty array when no wallets exist", () => {
      const { cleanup } = setup();

      const wallets = getStorageWallets();
      expect(wallets).toEqual([]);

      cleanup();
    });

    it("returns custodial wallets from storage", () => {
      const { storage, cleanup } = setup();

      const custodialWallets: LocalWallet[] = [
        { name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false },
        { name: "Wallet 2", address: WALLET_ADDRESS_2, selected: false, isManaged: false }
      ];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(custodialWallets));

      const result = getStorageWallets();
      expect(result).toEqual(custodialWallets);

      cleanup();
    });

    it("merges custodial and managed wallets", () => {
      const { storage, cleanup } = setup();

      const custodialWallets: LocalWallet[] = [{ name: "Wallet 1", address: WALLET_ADDRESS_1, selected: false, isManaged: false }];

      const managedWalletsMap = {
        [USER_ID_1]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_2,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false,
          cert: "cert1",
          certKey: "key1"
        }
      };

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(custodialWallets));
      storage.set(`${NETWORK_ID}/managed-wallets`, JSON.stringify(managedWalletsMap));

      const result = getStorageWallets();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(custodialWallets[0]);
      expect(result[1]).toEqual(managedWalletsMap[USER_ID_1]);

      cleanup();
    });

    it("prioritizes selected managed wallet", () => {
      const { storage, cleanup } = setup();

      const custodialWallets: LocalWallet[] = [{ name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false }];

      const managedWalletsMap = {
        [USER_ID_1]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_2,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false
        }
      };

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(custodialWallets));
      storage.set(`${NETWORK_ID}/managed-wallets`, JSON.stringify(managedWalletsMap));

      const result = getStorageWallets();

      expect(result[0].selected).toBe(false);
      expect(result[1].selected).toBe(true);
      expect(result[1].address).toBe(WALLET_ADDRESS_2);

      cleanup();
    });

    it("removes duplicate managed wallets from old storage", () => {
      const { storage, cleanup } = setup();

      const oldManagedWallet = {
        name: "Managed Wallet",
        address: WALLET_ADDRESS_2,
        userId: USER_ID_1,
        selected: false,
        isManaged: true,
        creditAmount: 100,
        isTrialing: false
      };

      const walletsWithOldFormat: LocalWallet[] = [
        { name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false },
        oldManagedWallet as LocalWallet
      ];

      const managedWalletsMap = {
        [USER_ID_1]: oldManagedWallet
      };

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(walletsWithOldFormat));
      storage.set(`${NETWORK_ID}/managed-wallets`, JSON.stringify(managedWalletsMap));

      const result = getStorageWallets();

      expect(result).toHaveLength(2);
      expect(result.filter((w: LocalWallet) => w.isManaged)).toHaveLength(1);

      cleanup();
    });

    it("handles corrupt managed-wallets JSON gracefully", () => {
      const { storage, cleanup } = setup();

      const custodialWallets: LocalWallet[] = [{ name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false }];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(custodialWallets));
      storage.set(`${NETWORK_ID}/managed-wallets`, "invalid-json{");

      const result = getStorageWallets();
      expect(result).toEqual(custodialWallets);

      cleanup();
    });

    it("respects networkId parameter", () => {
      const { storage, cleanup } = setup();

      const mainnetWallets: LocalWallet[] = [{ name: "Mainnet Wallet", address: WALLET_ADDRESS_1, selected: true, isManaged: false }];
      const testnetWallets: LocalWallet[] = [{ name: "Testnet Wallet", address: WALLET_ADDRESS_2, selected: true, isManaged: false }];

      storage.set("mainnet/wallets", JSON.stringify(mainnetWallets));
      storage.set("testnet/wallets", JSON.stringify(testnetWallets));

      expect(getStorageWallets("mainnet")).toEqual(mainnetWallets);
      expect(getStorageWallets("testnet")).toEqual(testnetWallets);

      cleanup();
    });
  });

  describe("getSelectedStorageWallet", () => {
    it("returns null when no wallets exist", () => {
      const { cleanup } = setup();

      expect(getSelectedStorageWallet()).toBeNull();

      cleanup();
    });

    it("returns first wallet when none is selected", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [
        { name: "Wallet 1", address: WALLET_ADDRESS_1, selected: false, isManaged: false },
        { name: "Wallet 2", address: WALLET_ADDRESS_2, selected: false, isManaged: false }
      ];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(wallets));

      const result = getSelectedStorageWallet();
      expect(result?.address).toBe(WALLET_ADDRESS_1);

      cleanup();
    });

    it("returns selected wallet", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [
        { name: "Wallet 1", address: WALLET_ADDRESS_1, selected: false, isManaged: false },
        { name: "Wallet 2", address: WALLET_ADDRESS_2, selected: true, isManaged: false }
      ];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(wallets));

      const result = getSelectedStorageWallet();
      expect(result?.address).toBe(WALLET_ADDRESS_2);

      cleanup();
    });

    it("returns selected managed wallet", () => {
      const { storage, cleanup } = setup();

      const managedWalletsMap = {
        [USER_ID_1]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_2,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false
        }
      };

      storage.set(`${NETWORK_ID}/managed-wallets`, JSON.stringify(managedWalletsMap));

      const result = getSelectedStorageWallet();
      expect(result?.address).toBe(WALLET_ADDRESS_2);
      expect(result?.isManaged).toBe(true);

      cleanup();
    });
  });

  describe("getStorageManagedWallet", () => {
    it("returns undefined when userId is not provided", () => {
      const { cleanup } = setup();

      expect(getStorageManagedWallet()).toBeUndefined();
      expect(getStorageManagedWallet("")).toBeUndefined();

      cleanup();
    });

    it("returns undefined when no managed wallets exist", () => {
      const { cleanup } = setup();

      const result = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      expect(result).toBeUndefined();

      cleanup();
    });

    it("returns managed wallet for specific user", () => {
      const { storage, cleanup } = setup();

      const managedWalletsMap = {
        [USER_ID_1]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_1,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false,
          cert: "cert1",
          certKey: "key1"
        },
        [USER_ID_2]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_2,
          userId: USER_ID_2,
          selected: false,
          isManaged: true,
          creditAmount: 200,
          isTrialing: true
        }
      };

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify(managedWalletsMap));

      const result1 = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      expect(result1?.address).toBe(WALLET_ADDRESS_1);
      expect(result1?.userId).toBe(USER_ID_1);
      expect(result1?.creditAmount).toBe(100);

      const result2 = getStorageManagedWallet(USER_ID_2, MANAGED_NETWORK_ID);
      expect(result2?.address).toBe(WALLET_ADDRESS_2);
      expect(result2?.userId).toBe(USER_ID_2);
      expect(result2?.creditAmount).toBe(200);

      cleanup();
    });

    it("returns undefined for non-existent userId", () => {
      const { storage, cleanup } = setup();

      const managedWalletsMap = {
        [USER_ID_1]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_1,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false
        }
      };

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify(managedWalletsMap));

      const result = getStorageManagedWallet("non-existent-user", MANAGED_NETWORK_ID);
      expect(result).toBeUndefined();

      cleanup();
    });

    it("handles corrupt JSON gracefully", () => {
      const { storage, cleanup } = setup();

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, "invalid-json");

      const result = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      expect(result).toBeUndefined();

      cleanup();
    });
  });

  describe("updateStorageManagedWallet", () => {
    it("creates new managed wallet", () => {
      const { cleanup } = setup();

      const wallet = {
        address: WALLET_ADDRESS_1,
        cert: "cert1",
        certKey: "key1",
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false,
        selected: true
      };

      const result = updateStorageManagedWallet(wallet);

      expect(result.name).toBe("Managed Wallet");
      expect(result.isManaged).toBe(true);
      expect(result.address).toBe(WALLET_ADDRESS_1);
      expect(result.selected).toBe(true);

      const stored = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      expect(stored).toEqual(result);

      cleanup();
    });

    it("updates existing managed wallet", () => {
      const { cleanup } = setup();

      const initial = {
        address: WALLET_ADDRESS_1,
        cert: "cert1",
        certKey: "key1",
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false
      };

      updateStorageManagedWallet(initial);

      const updated = {
        ...initial,
        creditAmount: 200,
        cert: "cert2"
      };

      const result = updateStorageManagedWallet(updated);

      expect(result.creditAmount).toBe(200);
      expect(result.cert).toBe("cert2");
      expect(result.certKey).toBe("key1");

      cleanup();
    });

    it("preserves other users' wallets (CRITICAL: multi-user isolation)", () => {
      const { cleanup } = setup();

      const user1Wallet = {
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false,
        cert: "cert1",
        certKey: "key1"
      };

      const user2Wallet = {
        address: WALLET_ADDRESS_2,
        userId: USER_ID_2,
        creditAmount: 200,
        isTrialing: true,
        cert: "cert2",
        certKey: "key2"
      };

      updateStorageManagedWallet(user1Wallet);
      updateStorageManagedWallet(user2Wallet);

      const storedUser1 = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      const storedUser2 = getStorageManagedWallet(USER_ID_2, MANAGED_NETWORK_ID);

      expect(storedUser1?.address).toBe(WALLET_ADDRESS_1);
      expect(storedUser2?.address).toBe(WALLET_ADDRESS_2);

      updateStorageManagedWallet({ ...user1Wallet, creditAmount: 300 });

      const updatedUser1 = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      const unchangedUser2 = getStorageManagedWallet(USER_ID_2, MANAGED_NETWORK_ID);

      expect(updatedUser1?.creditAmount).toBe(300);
      expect(unchangedUser2?.creditAmount).toBe(200);

      cleanup();
    });

    it("returns same object if no changes (optimization)", () => {
      const { cleanup } = setup();

      const wallet = {
        address: WALLET_ADDRESS_1,
        cert: "cert1",
        certKey: "key1",
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false,
        selected: true
      };

      const result1 = updateStorageManagedWallet(wallet);
      const result2 = updateStorageManagedWallet(wallet);

      expect(result1).toEqual(result2);

      cleanup();
    });

    it("defaults selected to false if not specified", () => {
      const { cleanup } = setup();

      const wallet = {
        address: WALLET_ADDRESS_1,
        cert: "cert1",
        certKey: "key1",
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false
      };

      const result = updateStorageManagedWallet(wallet);
      expect(result.selected).toBe(false);

      cleanup();
    });

    it("preserves selected state from previous wallet", () => {
      const { cleanup } = setup();

      const wallet = {
        address: WALLET_ADDRESS_1,
        cert: "cert1",
        certKey: "key1",
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false,
        selected: true
      };

      updateStorageManagedWallet(wallet);

      const updated = {
        address: WALLET_ADDRESS_1,
        cert: "cert2",
        certKey: "key2",
        userId: USER_ID_1,
        creditAmount: 200,
        isTrialing: false
      };

      const result = updateStorageManagedWallet(updated);
      expect(result.selected).toBe(true);

      cleanup();
    });
  });

  describe("updateStorageWallets", () => {
    it("stores custodial wallets in wallets array", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [
        { name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false },
        { name: "Wallet 2", address: WALLET_ADDRESS_2, selected: false, isManaged: false }
      ];

      updateStorageWallets(wallets);

      const stored = storage.get(`${NETWORK_ID}/wallets`);
      expect(JSON.parse(stored!)).toEqual(wallets);

      cleanup();
    });

    it("separates managed wallets to managed-wallets storage (CRITICAL: auto-migration)", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [
        { name: "Wallet 1", address: WALLET_ADDRESS_1, selected: false, isManaged: false },
        {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_2,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false
        } as LocalWallet
      ];

      updateStorageWallets(wallets);

      const custodialStored = JSON.parse(storage.get(`${NETWORK_ID}/wallets`)!);
      expect(custodialStored).toHaveLength(1);
      expect(custodialStored[0].address).toBe(WALLET_ADDRESS_1);

      const managedStored = JSON.parse(storage.get(`${NETWORK_ID}/managed-wallets`)!);
      expect(managedStored[USER_ID_1].address).toBe(WALLET_ADDRESS_2);

      cleanup();
    });

    it("preserves existing managed wallets for other users", () => {
      const { storage, cleanup } = setup();

      const existingUser2Wallet = {
        name: "Managed Wallet",
        address: WALLET_ADDRESS_3,
        userId: USER_ID_2,
        selected: false,
        isManaged: true,
        creditAmount: 200,
        isTrialing: true
      };

      storage.set(`${NETWORK_ID}/managed-wallets`, JSON.stringify({ [USER_ID_2]: existingUser2Wallet }));

      const wallets: LocalWallet[] = [
        {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_2,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false
        } as LocalWallet
      ];

      updateStorageWallets(wallets);

      const managedStored = JSON.parse(storage.get(`${NETWORK_ID}/managed-wallets`)!);
      expect(managedStored[USER_ID_1].address).toBe(WALLET_ADDRESS_2);
      expect(managedStored[USER_ID_2].address).toBe(WALLET_ADDRESS_3);

      cleanup();
    });

    it("handles empty wallet array", () => {
      const { storage, cleanup } = setup();

      updateStorageWallets([]);

      const stored = storage.get(`${NETWORK_ID}/wallets`);
      expect(JSON.parse(stored!)).toEqual([]);

      cleanup();
    });
  });

  describe("updateWallet", () => {
    it("updates custodial wallet", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [
        { name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false },
        { name: "Wallet 2", address: WALLET_ADDRESS_2, selected: false, isManaged: false }
      ];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(wallets));

      updateWallet(WALLET_ADDRESS_1, (w: LocalWallet) => ({ ...w, cert: "new-cert", certKey: "new-key" }));

      const updated = getStorageWallets();
      const wallet1 = updated.find((w: LocalWallet) => w.address === WALLET_ADDRESS_1);

      expect(wallet1?.cert).toBe("new-cert");
      expect(wallet1?.certKey).toBe("new-key");

      cleanup();
    });

    it("updates managed wallet", () => {
      const { storage, cleanup } = setup();

      const managedWallet = {
        name: "Managed Wallet",
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        selected: true,
        isManaged: true,
        creditAmount: 100,
        isTrialing: false
      };

      storage.set(`${NETWORK_ID}/managed-wallets`, JSON.stringify({ [USER_ID_1]: managedWallet }));

      updateWallet(WALLET_ADDRESS_1, (w: LocalWallet) => ({ ...w, cert: "new-cert" }), NETWORK_ID);

      const updated = getStorageManagedWallet(USER_ID_1, NETWORK_ID);
      expect(updated?.cert).toBe("new-cert");
      expect(updated?.userId).toBe(USER_ID_1);

      cleanup();
    });

    it("does nothing if wallet not found", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [{ name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false }];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(wallets));

      updateWallet("non-existent-address", (w: LocalWallet) => ({ ...w, cert: "new-cert" }));

      const stored = getStorageWallets();
      expect(stored).toHaveLength(1);
      expect(stored[0].cert).toBeUndefined();

      cleanup();
    });
  });

  describe("deleteWalletFromStorage", () => {
    it("removes wallet by address", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [
        { name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false },
        { name: "Wallet 2", address: WALLET_ADDRESS_2, selected: false, isManaged: false }
      ];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(wallets));

      const result = deleteWalletFromStorage(WALLET_ADDRESS_1, false);

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe(WALLET_ADDRESS_2);

      cleanup();
    });

    it("selects first remaining wallet after deletion", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [
        { name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false },
        { name: "Wallet 2", address: WALLET_ADDRESS_2, selected: false, isManaged: false }
      ];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(wallets));

      const result = deleteWalletFromStorage(WALLET_ADDRESS_1, false);

      expect(result[0].selected).toBe(true);

      cleanup();
    });

    it("removes wallet settings from localStorage", () => {
      const { storage, mockLocalStorage, cleanup } = setup();

      const wallets: LocalWallet[] = [{ name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false }];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(wallets));
      storage.set(`${NETWORK_ID}/${WALLET_ADDRESS_1}/settings`, "{}");
      storage.set(`${NETWORK_ID}/${WALLET_ADDRESS_1}/provider.data`, "{}");

      deleteWalletFromStorage(WALLET_ADDRESS_1, false);

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(`${NETWORK_ID}/${WALLET_ADDRESS_1}/settings`);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(`${NETWORK_ID}/${WALLET_ADDRESS_1}/provider.data`);

      cleanup();
    });

    it("removes deployments when deleteDeployments is true", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [{ name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false }];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(wallets));
      storage.set(`${NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/123`, "{}");
      storage.set(`${NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/456`, "{}");

      deleteWalletFromStorage(WALLET_ADDRESS_1, true);

      expect(storage.get(`${NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/123`)).toBeUndefined();
      expect(storage.get(`${NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/456`)).toBeUndefined();

      cleanup();
    });

    it("preserves deployments when deleteDeployments is false", () => {
      const { storage, cleanup } = setup();

      const wallets: LocalWallet[] = [{ name: "Wallet 1", address: WALLET_ADDRESS_1, selected: true, isManaged: false }];

      storage.set(`${NETWORK_ID}/wallets`, JSON.stringify(wallets));
      storage.set(`${NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/123`, "{}");

      deleteWalletFromStorage(WALLET_ADDRESS_1, false);

      expect(storage.get(`${NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/123`)).toBeDefined();

      cleanup();
    });
  });

  describe("deleteManagedWalletFromStorage", () => {
    it("removes managed wallet for specific user", () => {
      const { storage, cleanup } = setup();

      const managedWalletsMap = {
        [USER_ID_1]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_1,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false
        },
        [USER_ID_2]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_2,
          userId: USER_ID_2,
          selected: false,
          isManaged: true,
          creditAmount: 200,
          isTrialing: true
        }
      };

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify(managedWalletsMap));
      storage.set(`${MANAGED_NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/123`, "{}");

      deleteManagedWalletFromStorage(USER_ID_1, MANAGED_NETWORK_ID);

      const remainingMap = JSON.parse(storage.get(`${MANAGED_NETWORK_ID}/managed-wallets`)!);
      expect(remainingMap[USER_ID_1]).toBeUndefined();
      expect(remainingMap[USER_ID_2]).toBeDefined();
      expect(storage.get(`${MANAGED_NETWORK_ID}/${WALLET_ADDRESS_1}/deployments/123`)).toBeUndefined();

      cleanup();
    });

    it("removes managed-wallets key when last wallet is deleted", () => {
      const { storage, cleanup } = setup();

      const managedWalletsMap = {
        [USER_ID_1]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_1,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false
        }
      };

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify(managedWalletsMap));

      deleteManagedWalletFromStorage(USER_ID_1, MANAGED_NETWORK_ID);

      expect(storage.get(`${MANAGED_NETWORK_ID}/managed-wallets`)).toBeUndefined();

      cleanup();
    });

    it("does nothing if userId is empty", () => {
      const { storage, cleanup } = setup();

      const managedWalletsMap = {
        [USER_ID_1]: {
          name: "Managed Wallet",
          address: WALLET_ADDRESS_1,
          userId: USER_ID_1,
          selected: true,
          isManaged: true,
          creditAmount: 100,
          isTrialing: false
        }
      };

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify(managedWalletsMap));

      deleteManagedWalletFromStorage("", MANAGED_NETWORK_ID);

      const stored = storage.get(`${MANAGED_NETWORK_ID}/managed-wallets`);
      expect(stored).toBeDefined();

      cleanup();
    });

    it("does nothing if wallet doesn't exist", () => {
      const { cleanup } = setup();

      deleteManagedWalletFromStorage("non-existent-user", MANAGED_NETWORK_ID);

      cleanup();
    });
  });

  describe("ensureUserManagedWalletOwnership", () => {
    it("adds managed wallet to shared wallet list if missing", () => {
      const { storage, cleanup } = setup();

      const managedWallet = {
        name: "Managed Wallet",
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        selected: false,
        isManaged: true,
        creditAmount: 100,
        isTrialing: false
      };

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify({ [USER_ID_1]: managedWallet }));

      ensureUserManagedWalletOwnership(USER_ID_1);

      const wallets = getStorageWallets(MANAGED_NETWORK_ID);
      const found = wallets.find((w: LocalWallet) => w.isManaged && (w as { userId?: string }).userId === USER_ID_1);

      expect(found).toBeDefined();
      expect(found?.address).toBe(WALLET_ADDRESS_1);

      cleanup();
    });

    it("sets managed wallet as selected when adding to list", () => {
      const { storage, cleanup } = setup();

      const managedWallet = {
        name: "Managed Wallet",
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        selected: false,
        isManaged: true,
        creditAmount: 100,
        isTrialing: false
      };

      const custodialWallet = {
        name: "Custodial",
        address: WALLET_ADDRESS_2,
        selected: true,
        isManaged: false
      };

      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify({ [USER_ID_1]: managedWallet }));
      storage.set(`${MANAGED_NETWORK_ID}/wallets`, JSON.stringify([custodialWallet]));

      ensureUserManagedWalletOwnership(USER_ID_1);

      const wallets = getStorageWallets(MANAGED_NETWORK_ID);
      const managed = wallets.find((w: LocalWallet) => w.isManaged && (w as { userId?: string }).userId === USER_ID_1);

      expect(managed?.selected).toBe(true);

      cleanup();
    });

    it("does nothing if wallet doesn't exist", () => {
      const { cleanup } = setup();

      ensureUserManagedWalletOwnership("non-existent-user");

      const wallets = getStorageWallets(MANAGED_NETWORK_ID);
      expect(wallets).toHaveLength(0);

      cleanup();
    });

    it("updates wallet list if address changed", () => {
      const { storage, cleanup } = setup();

      const oldManagedWallet = {
        name: "Managed Wallet",
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        selected: true,
        isManaged: true,
        creditAmount: 100,
        isTrialing: false
      };

      const newManagedWallet = {
        ...oldManagedWallet,
        address: WALLET_ADDRESS_2
      };

      storage.set(`${MANAGED_NETWORK_ID}/wallets`, JSON.stringify([oldManagedWallet]));
      storage.set(`${MANAGED_NETWORK_ID}/managed-wallets`, JSON.stringify({ [USER_ID_1]: newManagedWallet }));

      ensureUserManagedWalletOwnership(USER_ID_1);

      const custodialWallets = JSON.parse(storage.get(`${MANAGED_NETWORK_ID}/wallets`)!);
      expect(custodialWallets.some((w: LocalWallet) => w.address === WALLET_ADDRESS_2)).toBe(false);

      cleanup();
    });
  });

  describe("CRITICAL BUG REGRESSION TESTS: No automatic deletion on disconnect", () => {
    it("managed wallet persists when user becomes undefined (disconnect scenario)", () => {
      const { cleanup } = setup();

      const managedWallet = {
        name: "Managed Wallet",
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        selected: true,
        isManaged: true,
        creditAmount: 100,
        isTrialing: false,
        cert: "cert1",
        certKey: "key1"
      };

      updateStorageManagedWallet(managedWallet);

      const beforeDisconnect = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      expect(beforeDisconnect).toBeDefined();

      const afterDisconnect = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      expect(afterDisconnect).toEqual(beforeDisconnect);
      expect(afterDisconnect?.cert).toBe("cert1");
      expect(afterDisconnect?.certKey).toBe("key1");

      cleanup();
    });

    it("managed wallet persists across network disconnections", () => {
      const { cleanup } = setup();

      const managedWallet = {
        name: "Managed Wallet",
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        selected: true,
        isManaged: true,
        creditAmount: 100,
        isTrialing: false,
        cert: "important-cert",
        certKey: "important-key"
      };

      updateStorageManagedWallet(managedWallet);

      for (let i = 0; i < 10; i++) {
        const retrieved = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
        expect(retrieved).toBeDefined();
        expect(retrieved?.cert).toBe("important-cert");
      }

      cleanup();
    });

    it("multiple users can disconnect and reconnect without losing data", () => {
      const { cleanup } = setup();

      const user1Wallet = {
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false,
        cert: "user1-cert",
        certKey: "user1-key"
      };

      const user2Wallet = {
        address: WALLET_ADDRESS_2,
        userId: USER_ID_2,
        creditAmount: 200,
        isTrialing: true,
        cert: "user2-cert",
        certKey: "user2-key"
      };

      updateStorageManagedWallet(user1Wallet);
      updateStorageManagedWallet(user2Wallet);

      const user1Retrieved = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      const user2Retrieved = getStorageManagedWallet(USER_ID_2, MANAGED_NETWORK_ID);

      expect(user1Retrieved?.cert).toBe("user1-cert");
      expect(user2Retrieved?.cert).toBe("user2-cert");

      cleanup();
    });
  });

  describe("Multi-user scenarios", () => {
    it("User A and User B can both have managed wallets on same browser", () => {
      const { cleanup } = setup();

      const userAWallet = {
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false,
        cert: "userA-cert",
        certKey: "userA-key"
      };

      const userBWallet = {
        address: WALLET_ADDRESS_2,
        userId: USER_ID_2,
        creditAmount: 200,
        isTrialing: true,
        cert: "userB-cert",
        certKey: "userB-key"
      };

      updateStorageManagedWallet(userAWallet);
      updateStorageManagedWallet(userBWallet);

      const storedA = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      const storedB = getStorageManagedWallet(USER_ID_2, MANAGED_NETWORK_ID);

      expect(storedA?.userId).toBe(USER_ID_1);
      expect(storedB?.userId).toBe(USER_ID_2);
      expect(storedA?.cert).toBe("userA-cert");
      expect(storedB?.cert).toBe("userB-cert");

      cleanup();
    });

    it("User B login doesn't erase User A data", () => {
      const { cleanup } = setup();

      const userAWallet = {
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false,
        cert: "userA-cert",
        certKey: "userA-key"
      };

      updateStorageManagedWallet(userAWallet);

      const userBWallet = {
        address: WALLET_ADDRESS_2,
        userId: USER_ID_2,
        creditAmount: 200,
        isTrialing: true,
        cert: "userB-cert",
        certKey: "userB-key",
        selected: true
      };

      updateStorageManagedWallet(userBWallet);

      const userAAfterBLogin = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      expect(userAAfterBLogin).toBeDefined();
      expect(userAAfterBLogin?.cert).toBe("userA-cert");
      expect(userAAfterBLogin?.userId).toBe(USER_ID_1);

      cleanup();
    });

    it("Users can switch between accounts without data loss", () => {
      const { cleanup } = setup();

      const userAWallet = {
        address: WALLET_ADDRESS_1,
        userId: USER_ID_1,
        creditAmount: 100,
        isTrialing: false,
        cert: "userA-cert",
        certKey: "userA-key",
        selected: true
      };

      const userBWallet = {
        address: WALLET_ADDRESS_2,
        userId: USER_ID_2,
        creditAmount: 200,
        isTrialing: true,
        cert: "userB-cert",
        certKey: "userB-key",
        selected: false
      };

      updateStorageManagedWallet(userAWallet);
      updateStorageManagedWallet(userBWallet);

      updateStorageManagedWallet({ ...userBWallet, selected: true });
      updateStorageManagedWallet({ ...userAWallet, selected: false });

      const allWallets = getStorageWallets(MANAGED_NETWORK_ID);
      expect(allWallets).toHaveLength(2);

      const userAStored = getStorageManagedWallet(USER_ID_1, MANAGED_NETWORK_ID);
      const userBStored = getStorageManagedWallet(USER_ID_2, MANAGED_NETWORK_ID);

      expect(userAStored?.cert).toBe("userA-cert");
      expect(userBStored?.cert).toBe("userB-cert");

      cleanup();
    });
  });

  function setup() {
    const storage = new Map<string, string>();

    const mockLocalStorage = mock<Storage>({
      getItem: jest.fn((key: string) => storage.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: jest.fn((key: string) => {
        storage.delete(key);
      }),
      clear: jest.fn(() => {
        storage.clear();
      }),
      key: jest.fn((index: number) => {
        const keys = Array.from(storage.keys());
        return keys[index] ?? null;
      }),
      length: 0
    });

    Object.defineProperty(mockLocalStorage, "length", {
      get: () => storage.size,
      enumerable: true,
      configurable: true
    });

    const originalLocalStorage = global.localStorage;

    const localStorageProxy = new Proxy(mockLocalStorage, {
      ownKeys: () => {
        return Array.from(storage.keys());
      },
      getOwnPropertyDescriptor: (target, key) => {
        if (storage.has(key as string)) {
          return {
            enumerable: true,
            configurable: true,
            value: storage.get(key as string)
          };
        }
        return undefined;
      }
    });

    Object.defineProperty(global, "localStorage", {
      value: localStorageProxy,
      writable: true,
      configurable: true
    });

    Object.defineProperty(networkStore, "selectedNetworkId", {
      value: NETWORK_ID,
      writable: true,
      configurable: true
    });
    Object.defineProperty(browserEnvConfig, "NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID", {
      value: MANAGED_NETWORK_ID,
      writable: true,
      configurable: true
    });

    return {
      mockLocalStorage,
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
