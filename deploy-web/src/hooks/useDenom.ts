import { usdcIbcDenoms } from "@src/utils/constants";
import { getSelectedNetwork, useSelectedNetwork } from "./useSelectedNetwork";

export const useUsdcDenom = () => {
  const selectedNetwork = useSelectedNetwork();
  return usdcIbcDenoms[selectedNetwork.id];
};

export const getUsdcDenom = () => {
  const selectedNetwork = getSelectedNetwork();
  return usdcIbcDenoms[selectedNetwork.id];
};

export const useSdlDenoms = () => {
  const usdcDenom = useUsdcDenom();

  return [
    { id: "uakt", label: "uAKT", value: "uakt" },
    { id: "uusdc", label: "uUSDC", value: usdcDenom }
  ];
};
