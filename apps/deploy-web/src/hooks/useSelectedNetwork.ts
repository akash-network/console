import { useAtom } from "jotai";
import { useEffectOnce } from "usehooks-ts";

import networkStore, { networks } from "@src/store/networkStore";
import { mainnetId } from "@src/utils/constants";

export const getSelectedNetwork = () => {
  const selectedNetworkId = (typeof window !== "undefined" && localStorage.getItem("selectedNetworkId")) ?? mainnetId;
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

  return selectedNetwork ?? networks[0];
};
