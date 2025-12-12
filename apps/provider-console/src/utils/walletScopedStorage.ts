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
    try {
      return value === "undefined" ? undefined : (JSON.parse(value ?? "") as T);
    } catch (error) {
      return value === "undefined" ? undefined : (value as unknown as T);
    }
  };

  return {
    getItem: (_key: string, initialValue: T): PromiseLike<T> => {
      if (typeof window === "undefined") {
        return Promise.resolve(initialValue);
      }

      try {
        const storageKey = getStorageKey();
        const item = localStorage.getItem(storageKey);
        return Promise.resolve(item ? parseJSON(item) ?? initialValue : initialValue);
      } catch (error) {
        console.warn(`Error reading localStorage key "${getStorageKey()}":`, error);
        return Promise.resolve(initialValue);
      }
    },

    setItem: (_key: string, newValue: T): PromiseLike<void> => {
      if (typeof window === "undefined") {
        console.warn(`Tried setting localStorage key "${getStorageKey()}" even though environment is not a client`);
        return Promise.resolve();
      }

      try {
        const storageKey = getStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(newValue));
        return Promise.resolve();
      } catch (error) {
        console.warn(`Error setting localStorage key "${getStorageKey()}":`, error);
        return Promise.resolve();
      }
    },

    removeItem: (_key: string): PromiseLike<void> => {
      if (typeof window === "undefined") {
        return Promise.resolve();
      }

      try {
        const storageKey = getStorageKey();
        localStorage.removeItem(storageKey);
        return Promise.resolve();
      } catch (error) {
        console.warn(`Error removing localStorage key "${getStorageKey()}":`, error);
        return Promise.resolve();
      }
    }
  };
}
