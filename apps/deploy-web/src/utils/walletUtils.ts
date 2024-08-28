import { isEqual } from "lodash";

import { envConfig } from "@src/config/env.config";
import { mainnetId } from "./constants";

interface BaseLocalWallet {
  address: string;
  cert?: string;
  certKey?: string;
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

export function getSelectedStorageWallet() {
  const wallets = getStorageWallets();

  return wallets.find(w => w.selected) ?? wallets[0] ?? null;
}

export function getStorageManagedWallet(networkId?: string): ManagedLocalWallet | undefined {
  return getStorageWallets(networkId).find(wallet => wallet.isManaged) as ManagedLocalWallet | undefined;
}

export function updateStorageManagedWallet(
  wallet: Pick<ManagedLocalWallet, "address" | "cert" | "certKey" | "userId" | "creditAmount" | "isTrialing"> & { selected?: boolean }
): ManagedLocalWallet {
  const networkId = envConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
  const wallets = getStorageWallets(networkId);
  const prevIndex = wallets.findIndex(({ isManaged }) => isManaged);
  const prev = wallets[prevIndex];

  const next: ManagedLocalWallet = {
    ...prev,
    ...wallet,
    name: "Managed Wallet",
    isManaged: true,
    selected: typeof wallet.selected === "boolean" ? wallet.selected : typeof prev?.selected === "boolean" ? prev.selected : false
  };

  if (isEqual(prev, next)) {
    return next;
  }

  if (prev && prev?.address !== next.address) {
    deleteManagedWalletFromStorage();
  }

  if (next.selected && !prev?.selected) {
    wallets.forEach(item => {
      item.selected = false;
    });
  }

  if (prevIndex !== -1) {
    wallets.splice(prevIndex, 1, next);
  } else {
    wallets.push(next);
  }
  updateStorageWallets(wallets, networkId);

  return next;
}

export function deleteManagedWalletFromStorage(networkId?: string) {
  const wallet = getStorageManagedWallet(networkId);
  if (wallet) {
    deleteWalletFromStorage(wallet.address, true, networkId);
  }
}

export function getStorageWallets(networkId?: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const selectedNetworkId = networkId || localStorage.getItem("selectedNetworkId") || mainnetId;
  const wallets = JSON.parse(localStorage.getItem(`${selectedNetworkId}/wallets`) || "[]") as LocalWallet[];

  return wallets || [];
}

export function updateWallet(address: string, func: (w: LocalWallet) => LocalWallet, networkId?: string) {
  const wallets = getStorageWallets(networkId);
  let wallet = wallets.find(w => w.address === address);

  if (wallet) {
    wallet = func(wallet);

    const newWallets = wallets.map(w => (w.address === address ? (wallet as LocalWallet) : w));
    updateStorageWallets(newWallets, networkId);
  }
}

export function updateStorageWallets(wallets: LocalWallet[], networkId?: string) {
  const selectedNetworkId = networkId || localStorage.getItem("selectedNetworkId") || mainnetId;
  localStorage.setItem(`${selectedNetworkId}/wallets`, JSON.stringify(wallets));
}

export function deleteWalletFromStorage(address: string, deleteDeployments: boolean, networkId?: string) {
  const selectedNetworkId = networkId || localStorage.getItem("selectedNetworkId") || mainnetId;
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
  const wallet = getStorageManagedWallet();

  if (wallet?.userId !== userId) {
    deleteManagedWalletFromStorage();
  }
}
