import { MAINNET_ID } from "@akashnetwork/network-store";
import { useAtom } from "jotai";
import { useEffectOnce } from "usehooks-ts";

import networkStore, { networks } from "@/store/networkStore";

export const getSelectedNetwork = () => {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId") ?? MAINNET_ID;
  const selectedNetwork = networks.find(n => n.id === selectedNetworkId);

  // return mainnet if selected network is not found
  return selectedNetwork ?? networks[0];
};

export const useSelectedNetwork = () => {
  const [selectedNetwork, setSelectedNetwork] = useAtom(networkStore.selectedNetwork);

  useEffectOnce(() => {
    const selectedNetworkId = localStorage.getItem("selectedNetworkId") ?? MAINNET_ID;
    setSelectedNetwork(networks.find(n => n.id === selectedNetworkId) || networks[0]);
  });

  return selectedNetwork ?? networks[0];
};
