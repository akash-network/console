import { useEffect } from "react";
import { useAtom } from "jotai";

import networkStore, { networks } from "@src/store/networkStore";

export const getSelectedNetwork = () => {
  // Since we now only have one network based on environment, return it directly
  return networks[0];
};

export const useSelectedNetwork = () => {
  const [selectedNetwork, setSelectedNetwork] = useAtom(networkStore.selectedNetwork);

  useEffect(() => {
    // Set the network based on environment configuration
    setSelectedNetwork(networks[0]);
  }, [setSelectedNetwork]);

  return selectedNetwork ?? networks[0];
};
