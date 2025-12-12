import type { AsyncStorage } from "jotai/vanilla/utils/atomWithStorage";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { mainnetId } from "@src/utils/constants";

/**
 * Creates a wallet-scoped storage implementation for jotai's atomWithStorage.
 * Storage keys are formatted as: `${networkId}/${walletAddress}/${key}`
 *
 * @param baseKey - The base key name (e.g., "providerProcess")
 * @returns An AsyncStorage implementation that scopes keys by network and wallet address
 */
export function createWalletScopedStorage<T>(baseKey: string): AsyncStorage<T> {
  const getStorageKey = (): string => {
    if (typeof window === "undefined") {
      return baseKey;
    }

    const selectedNetworkId = browserEnvConfig.NEXT_PUBLIC_SELECTED_NETWORK ?? mainnetId;
    // Get wallet address from localStorage (set by WalletProvider)
    const walletAddress = localStorage.getItem("walletAddress");

    if (walletAddress) {
      return `${selectedNetworkId}/${walletAddress}/${baseKey}`;
    }

    // Fallback to network-scoped key if no wallet is connected
    return `${selectedNetworkId}/${baseKey}`;
  };

  const parseJSON = (value: string): T | undefined => {
    if (value == null || value === "undefined") {
      return undefined;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      return undefined;
    }
  };

  const maskStorageKey = (key: string): string => {
    const parts = key.split("/");
    if (parts.length === 3 && parts[1].length > 10) {
      const walletAddress = parts[1];
      const masked = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      return `${parts[0]}/${masked}/${parts[2]}`;
    }
    return key;
  };

  return {
    getItem: (_key: string, initialValue: T): PromiseLike<T> => {
      if (typeof window === "undefined") {
        return Promise.resolve(initialValue);
      }

      const storageKey = getStorageKey();
      const maskedKey = maskStorageKey(storageKey);

      try {
        const item = localStorage.getItem(storageKey);
        return Promise.resolve(item ? parseJSON(item) ?? initialValue : initialValue);
      } catch (error) {
        console.warn(`Error reading localStorage key "${maskedKey}":`, error);
        return Promise.resolve(initialValue);
      }
    },

    setItem: (_key: string, newValue: T): PromiseLike<void> => {
      if (typeof window === "undefined") {
        const storageKey = getStorageKey();
        const maskedKey = maskStorageKey(storageKey);
        console.warn(`Tried setting localStorage key "${maskedKey}" even though environment is not a client`);
        return Promise.resolve();
      }

      const storageKey = getStorageKey();
      const maskedKey = maskStorageKey(storageKey);

      try {
        localStorage.setItem(storageKey, JSON.stringify(newValue));
        return Promise.resolve();
      } catch (error) {
        console.warn(`Error setting localStorage key "${maskedKey}":`, error);
        return Promise.resolve();
      }
    },

    removeItem: (_key: string): PromiseLike<void> => {
      if (typeof window === "undefined") {
        return Promise.resolve();
      }

      const storageKey = getStorageKey();
      const maskedKey = maskStorageKey(storageKey);

      try {
        localStorage.removeItem(storageKey);
        return Promise.resolve();
      } catch (error) {
        console.warn(`Error removing localStorage key "${maskedKey}":`, error);
        return Promise.resolve();
      }
    }
  };
}
