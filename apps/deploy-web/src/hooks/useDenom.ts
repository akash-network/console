import { useServices } from "@src/context/ServicesProvider";
import { getUsdcDenom } from "@src/utils/priceUtils";

export const useUsdcDenom = (): string => {
  const { networkStore } = useServices();
  const selectedNetworkId = networkStore.useSelectedNetworkId();
  return getUsdcDenom(selectedNetworkId);
};

export const useSdlDenoms = () => {
  const usdcDenom = useUsdcDenom();

  return [
    { id: "uakt", label: "uAKT", tokenLabel: "AKT", value: "uakt" },
    { id: "uusdc", label: "uUSDC", tokenLabel: "USDC", value: usdcDenom }
  ];
};
