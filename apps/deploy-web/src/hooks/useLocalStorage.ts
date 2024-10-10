import { useWallet } from "@src/context/WalletProvider";
import networkStore from "@src/store/networkStore";

export const useLocalStorage = () => {
  const { address } = useWallet();
  const selectedNetworkId = networkStore.useSelectedNetworkId();

  const getLocalStorageItem = (key: string) => {
    return localStorage.getItem(`${selectedNetworkId}${address ? "/" + address : ""}/${key}`);
  };

  const setLocalStorageItem = (key: string, value: string) => {
    localStorage.setItem(`${selectedNetworkId}${address ? "/" + address : ""}/${key}`, value);
  };

  const removeLocalStorageItem = (key: string) => {
    localStorage.removeItem(`${selectedNetworkId}${address ? "/" + address : ""}/${key}`);
  };

  return {
    removeLocalStorageItem,
    setLocalStorageItem,
    getLocalStorageItem
  };
};
