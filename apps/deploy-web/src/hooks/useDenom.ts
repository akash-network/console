import { useMemo } from "react";

import { UACT_DENOM } from "@src/config/denom.config";
import { useServices } from "@src/context/ServicesProvider";
import { getUsdcDenom } from "@src/utils/priceUtils";

export const DEPENDENCIES = {
  useServices
};

export const useUsdcDenom = (dependencies: typeof DEPENDENCIES = DEPENDENCIES): string => {
  const { networkStore } = dependencies.useServices();
  const selectedNetworkId = networkStore.useSelectedNetworkId();
  return getUsdcDenom(selectedNetworkId);
};

export const useSupportedDenoms = () => {
  return useMemo(() => {
    return [{ id: UACT_DENOM, label: "uACT", tokenLabel: "ACT", value: UACT_DENOM }];
  }, []);
};
