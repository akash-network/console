import networkStore from "@src/store/networkStore";
import { usdcIbcDenoms } from "@src/utils/constants";

export const useUsdcDenom = () => {
  const selectedNetwork = networkStore.useSelectedNetwork();
  return usdcIbcDenoms[selectedNetwork.id];
};

export const getUsdcDenom = () => {
  const selectedNetwork = networkStore.getSelectedNetwork();
  return usdcIbcDenoms[selectedNetwork.id];
};

export const useSdlDenoms = () => {
  const usdcDenom = useUsdcDenom();

  return [
    { id: "uakt", label: "uAKT", tokenLabel: "AKT", value: "uakt" },
    { id: "uusdc", label: "uUSDC", tokenLabel: "USDC", value: usdcDenom }
  ];
};
