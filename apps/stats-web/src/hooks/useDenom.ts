import { useSelectedNetwork } from "./useSelectedNetwork";

import { USDC_IBC_DENOMS } from "@/config/denom.config";

export const useUsdcDenom = () => {
  const selectedNetwork = useSelectedNetwork();
  return USDC_IBC_DENOMS[selectedNetwork.id];
};
