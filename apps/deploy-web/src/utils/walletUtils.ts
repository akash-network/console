import type { NetworkId } from "@akashnetwork/chain-sdk/web";
import { isEqual } from "lodash";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { services } from "@src/services/app-di-container/browser-di-container";
import networkStore from "@src/store/networkStore";

interface BaseLocalWallet {
  address: string;
  cert?: string;
  certKey?: string;
  token?: string;
  selected: boolean;
}

interface ManagedLocalWallet extends BaseLocalWallet {
  name: "Managed Wallet";
  isManaged: true;
  userId: string;
  creditAmount: number;
  isTrialing: boolean;
}

interface CustodialLocalWallet extends BaseLocalWallet {
  name: string;
  isManaged: false;
}
export type LocalWallet = ManagedLocalWallet | CustodialLocalWallet;

function getManagedWalletsStorageKey(networkId: NetworkId): string {
  return `${networkId}/managed-wallets`;
}

export function getSelectedStorageWallet() {
  const wallets = getStorageWallets();

  return wallets.find(w => w.selected) ?? wallets[0] ?? null;
}

export function getStorageManagedWallet(userId?: string, networkId?: NetworkId): ManagedLocalWallet | undefined {
  if (!userId || typeof window === "undefined") {
    return undefined;
  }

  const selectedNetworkId: NetworkId = networkId || browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
  const key = getManagedWalletsStorageKey(selectedNetworkId);
  const walletsMapStr = localStorage.getItem(key);

  if (!walletsMapStr) {
    return undefined;
  }

  try {
    const walletsMap = JSON.parse(walletsMapStr) as Record<string, ManagedLocalWallet>;
    return walletsMap[userId];
  } catch {
    return undefined;
  }
}

export function updateStorageManagedWallet(
  wallet: Pick<ManagedLocalWallet, "address" | "cert" | "certKey" | "userId" | "creditAmount" | "isTrialing"> & { selected?: boolean }
): ManagedLocalWallet {
  const networkId = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
  const prev = getStorageManagedWallet(wallet.userId, networkId);

  const next: ManagedLocalWallet = {
    ...prev,
    ...wallet,
    name: "Managed Wallet",
    isManaged: true,
    selected: typeof wallet.selected === "boolean" ? wallet.selected : prev?.selected ?? false
  };

  if (isEqual(prev, next)) {
    return next;
  }

  const key = getManagedWalletsStorageKey(networkId);
  const walletsMapStr = localStorage.getItem(key);
  let walletsMap: Record<string, ManagedLocalWallet> = {};

  if (walletsMapStr) {
    try {
      walletsMap = JSON.parse(walletsMapStr);
    } catch (error) {
      services.errorHandler.reportError({
        error,
        severity: "warning",
        tags: { context: "walletUtils.updateStorageManagedWallet" },
        walletsMapStr
      });
    }
  }

  walletsMap[wallet.userId] = next;
  localStorage.setItem(key, JSON.stringify(walletsMap));

  return next;
}

export function deleteManagedWalletFromStorage(userId: string, networkId?: NetworkId) {
  if (!userId) {
    return;
  }

  const wallet = getStorageManagedWallet(userId, networkId);
  if (wallet) {
    const selectedNetworkId: NetworkId = networkId || browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
    const key = getManagedWalletsStorageKey(selectedNetworkId);
    const walletsMapStr = localStorage.getItem(key);

    if (walletsMapStr) {
      try {
        const walletsMap: Record<string, ManagedLocalWallet> = JSON.parse(walletsMapStr);
        delete walletsMap[userId];

        if (Object.keys(walletsMap).length > 0) {
          localStorage.setItem(key, JSON.stringify(walletsMap));
        } else {
          localStorage.removeItem(key);
        }
      } catch (error) {
        services.errorHandler.reportError({
          error,
          severity: "warning",
          tags: { context: "walletUtils.deleteManagedWalletFromStorage" },
          walletsMapStr,
          userId
        });
        localStorage.removeItem(key);
      }
    }

    deleteWalletFromStorage(wallet.address, true, networkId);
  }
}

export function getStorageWallets(networkId?: NetworkId) {
  if (typeof window === "undefined") {
    return [];
  }

  const selectedNetworkId: NetworkId = networkId || networkStore.selectedNetworkId;
  const wallets = JSON.parse(localStorage.getItem(`${selectedNetworkId}/wallets`) || "[]") as LocalWallet[];

  const managedWalletsKey = getManagedWalletsStorageKey(selectedNetworkId);
  const managedWalletsMapStr = localStorage.getItem(managedWalletsKey);

  if (managedWalletsMapStr) {
    try {
      const managedWalletsMap = JSON.parse(managedWalletsMapStr) as Record<string, ManagedLocalWallet>;
      const managedWallets = Object.values(managedWalletsMap);

      const managedWalletAddresses = new Set(managedWallets.map(w => w.address));
      const custodialWallets = wallets.filter(w => !w.isManaged || !managedWalletAddresses.has(w.address));

      const selectedManagedWallet = managedWallets.find(w => w.selected);
      const mergedWallets = [...custodialWallets, ...managedWallets];

      if (selectedManagedWallet) {
        return mergedWallets.map(w => ({
          ...w,
          selected: w.address === selectedManagedWallet.address && w.isManaged
        }));
      }

      return mergedWallets;
    } catch {
      return wallets;
    }
  }

  return wallets;
}

export function updateWallet(address: string, func: (w: LocalWallet) => LocalWallet, networkId?: NetworkId) {
  const wallets = getStorageWallets(networkId);
  let wallet = wallets.find(w => w.address === address);

  if (wallet) {
    wallet = func(wallet);

    const newWallets = wallets.map(w => (w.address === address ? (wallet as LocalWallet) : w));
    updateStorageWallets(newWallets, networkId);
  }
}

export function updateStorageWallets(wallets: LocalWallet[], networkId?: NetworkId) {
  const selectedNetworkId = networkId || networkStore.selectedNetworkId;

  const managedWallets = wallets.filter(w => w.isManaged) as ManagedLocalWallet[];
  const custodialWallets = wallets.filter(w => !w.isManaged);

  if (managedWallets.length > 0) {
    const managedWalletsKey = getManagedWalletsStorageKey(selectedNetworkId);
    const existingMapStr = localStorage.getItem(managedWalletsKey);
    let existingMap: Record<string, ManagedLocalWallet> = {};

    if (existingMapStr) {
      try {
        existingMap = JSON.parse(existingMapStr);
      } catch (error) {
        services.errorHandler.reportError({
          error,
          severity: "warning",
          tags: { context: "walletUtils.updateStorageWallets" },
          existingMapStr
        });
      }
    }

    managedWallets.forEach(wallet => {
      existingMap[wallet.userId] = wallet;
    });

    localStorage.setItem(managedWalletsKey, JSON.stringify(existingMap));
  }

  localStorage.setItem(`${selectedNetworkId}/wallets`, JSON.stringify(custodialWallets));
}

export function deleteWalletFromStorage(address: string, deleteDeployments: boolean, networkId?: NetworkId) {
  const selectedNetworkId = networkId || networkStore.selectedNetworkId;
  const wallets = getStorageWallets();
  const newWallets = wallets.filter(w => w.address !== address).map((w, i) => ({ ...w, selected: i === 0 }));

  updateStorageWallets(newWallets);

  localStorage.removeItem(`${selectedNetworkId}/${address}/settings`);
  localStorage.removeItem(`${selectedNetworkId}/${address}/provider.data`);

  if (deleteDeployments) {
    const deploymentKeys = Object.keys(localStorage).filter(key => key.startsWith(`${selectedNetworkId}/${address}/deployments/`));
    for (const deploymentKey of deploymentKeys) {
      localStorage.removeItem(deploymentKey);
    }
  }

  return newWallets;
}

export function useSelectedWalletFromStorage() {
  return getSelectedStorageWallet();
}

export function ensureUserManagedWalletOwnership(userId: string) {
  const networkId = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
  const wallet = getStorageManagedWallet(userId, networkId);

  if (wallet) {
    updateStorageManagedWallet({ ...wallet, selected: true });

    const wallets = getStorageWallets(networkId);
    const updatedWallets = wallets.filter(w => !w.isManaged).map(w => ({ ...w, selected: false }));

    updateStorageWallets(updatedWallets, networkId);
  }
}
