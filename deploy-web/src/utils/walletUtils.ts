import { mainnetId } from "./constants";

export const useStorageWallets = () => {
  const wallets = getStorageWallets();

  return { wallets };
};

export function getSelectedStorageWallet() {
  const wallets = getStorageWallets();

  return wallets.find(w => w.selected) || wallets[0] || {};
}

export function getStorageWallets() {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId") || mainnetId;
  const wallets = JSON.parse(localStorage.getItem(`${selectedNetworkId}/wallets`));

  return wallets || [];
}

export function updateWallet(address, func) {
  const wallets = getStorageWallets();
  let wallet = wallets.find(w => w.address === address);
  wallet = func(wallet);

  const newWallets = wallets.map(w => (w.address === address ? wallet : w));
  updateStorageWallets(newWallets);
}

export function updateStorageWallets(wallets) {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId") || mainnetId;
  localStorage.setItem(`${selectedNetworkId}/wallets`, JSON.stringify(wallets));
}

export function deleteWalletFromStorage(address, deleteDeployments) {
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

export function updateLocalStorageWalletName(address, name) {
  updateWallet(address, wallet => {
    return { ...wallet, name };
  });
}
