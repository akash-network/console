import { USDC_IBC_DENOMS } from "@src/config/denom.config";
import networkStore from "@src/store/networkStore";

export const useUsdcDenom = () => {
  const selectedNetwork = networkStore.useSelectedNetwork();
  return USDC_IBC_DENOMS[selectedNetwork.id];
};

export const getUsdcDenom = () => {
  const selectedNetwork = networkStore.getSelectedNetwork();
  return USDC_IBC_DENOMS[selectedNetwork.id];
};

export const useSdlDenoms = () => {
  const usdcDenom = useUsdcDenom();

  return [
    { id: "uakt", label: "uAKT", tokenLabel: "AKT", value: "uakt" },
    { id: "uusdc", label: "uUSDC", tokenLabel: "USDC", value: usdcDenom }
  ];
};
