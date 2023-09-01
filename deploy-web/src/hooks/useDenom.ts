import { usdcIbcDenoms } from "@src/utils/constants";
import { getSelectedNetwork, useSelectedNetwork } from "@src/utils/networks";

export const useUsdcDenom = () => {
  const selectedNetwork = useSelectedNetwork();
  return usdcIbcDenoms[selectedNetwork.id];
};

export const getUsdcDenom = () => {
  const selectedNetwork = getSelectedNetwork();
  return usdcIbcDenoms[selectedNetwork.id];
};
