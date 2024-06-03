import { getSelectedNetwork, useSelectedNetwork } from "./useSelectedNetwork";

import { usdcIbcDenoms } from "@/lib/constants";

export const useUsdcDenom = () => {
  const selectedNetwork = useSelectedNetwork();
  return usdcIbcDenoms[selectedNetwork.id];
};

export const getUsdcDenom = () => {
  const selectedNetwork = getSelectedNetwork();
  return usdcIbcDenoms[selectedNetwork.id as any];
};

export const useSdlDenoms = () => {
  const usdcDenom = useUsdcDenom();

  return [
    { id: "uakt", label: "uAKT", tokenLabel: "AKT", value: "uakt" },
    { id: "uusdc", label: "uUSDC", tokenLabel: "USDC", value: usdcDenom }
  ];
};
