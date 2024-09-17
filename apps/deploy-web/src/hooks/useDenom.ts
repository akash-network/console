import { USDC_IBC_DENOMS } from "@src/config/denom.config";
import networkStore from "@src/store/networkStore";

export const useUsdcDenom = () => {
  return USDC_IBC_DENOMS[networkStore.selectedNetworkId];
};

export const getUsdcDenom = () => {
  return USDC_IBC_DENOMS[networkStore.selectedNetworkId];
};

export const useSdlDenoms = () => {
  const usdcDenom = useUsdcDenom();

  return [
    { id: "uakt", label: "uAKT", tokenLabel: "AKT", value: "uakt" },
    { id: "uusdc", label: "uUSDC", tokenLabel: "USDC", value: usdcDenom }
  ];
};
