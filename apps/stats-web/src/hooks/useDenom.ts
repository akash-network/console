import { USDC_IBC_DENOMS } from "@/config/denom.config";
import { networkStore } from "@/store/network.store";

export const useUsdcDenom = () => {
  const selectedNetworkId = networkStore.useSelectedNetworkId();
  return USDC_IBC_DENOMS[selectedNetworkId];
};
