import { mainnetId } from "./constants";

export type LocalWalletDataType = {
  address: string;
  cert?: string;
  certKey?: string;
  name: string;
  selected: boolean;
  isManaged?: boolean;
};

export const useStorageWallets = () => {
  const wallets = getStorageWallets();

  return { wallets };
};

export function getSelectedStorageWallet() {
  const wallets = getStorageWallets();

  return wallets.find(w => w.selected) ?? wallets[0] ?? null;
}

export function getStorageWallets() {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId") || mainnetId;
  const wallets = JSON.parse(localStorage.getItem(`${selectedNetworkId}/wallets`) || "[]") as LocalWalletDataType[];

  return wallets || [];
}

export function updateWallet(address: string, func: (w: LocalWalletDataType) => LocalWalletDataType) {
  const wallets = getStorageWallets();
  let wallet = wallets.find(w => w.address === address);

  if (wallet) {
    wallet = func(wallet);

    const newWallets = wallets.map(w => (w.address === address ? (wallet as LocalWalletDataType) : w));
    updateStorageWallets(newWallets);
  }
}

export function selectLocalWallet(wallet: Omit<LocalWalletDataType, "selected">) {
  const prev = getStorageWallets();
  const existingWallet = prev.find(w => w.address === wallet.address);
  const next = prev.map(w => ({ ...w, selected: false }));

  if (existingWallet) {
    existingWallet.selected = true;
  } else {
    next.push({ ...wallet, selected: true });
  }

  updateStorageWallets(next);
}

export function updateStorageWallets(wallets: LocalWalletDataType[]) {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId") || mainnetId;
  localStorage.setItem(`${selectedNetworkId}/wallets`, JSON.stringify(wallets));
}

export function deleteWalletFromStorage(address: string, deleteDeployments: boolean) {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId") || mainnetId;
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

export function updateLocalStorageWalletName(address: string, name: string) {
  updateWallet(address, wallet => {
    return { ...wallet, name };
  });
}
