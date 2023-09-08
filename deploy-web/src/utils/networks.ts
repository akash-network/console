import { useEffectOnce } from "usehooks-ts";
import { mainnetId } from "./constants";
import { useAtom } from "jotai";
import networkStore, { networks } from "@src/store/networkStore";

export const getSelectedNetwork = () => {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId") ?? mainnetId;
  const selectedNetwork = networks.find(n => n.id === selectedNetworkId);

  // return mainnet if selected network is not found
  return selectedNetwork ?? networks[0];
};

export const useSelectedNetwork = () => {
  const [selectedNetwork, setSelectedNetwork] = useAtom(networkStore.selectedNetwork);

  useEffectOnce(() => {
    const selectedNetworkId = localStorage.getItem("selectedNetworkId") ?? mainnetId;
    setSelectedNetwork(networks.find(n => n.id === selectedNetworkId) || networks[0]);
  });

  return selectedNetwork;
};
