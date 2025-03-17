import { useMemo } from "react";

import { USDC_IBC_DENOMS } from "@src/config/denom.config";
import { AutoTopUpMessageService } from "@src/services/auto-top-up-message/auto-top-up-message.service";
import networkStore from "@src/store/networkStore";

export const useAutoTopUpService = () => {
  const selectedNetworkId = networkStore.useSelectedNetworkId();
  // BUGALERT: there is no testnet network in USDC_IBC_DENOMS
  const usdcDenom = USDC_IBC_DENOMS[selectedNetworkId as keyof typeof USDC_IBC_DENOMS];

  return useMemo(() => new AutoTopUpMessageService(usdcDenom), [usdcDenom]);
};
