import { useMemo } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import { getUsdcDenom } from "@src/utils/priceUtils";

export const DEPENDENCIES = {
  useServices,
  useSupportsACT
};

export const useUsdcDenom = (dependencies: typeof DEPENDENCIES = DEPENDENCIES): string => {
  const { networkStore } = dependencies.useServices();
  const selectedNetworkId = networkStore.useSelectedNetworkId();
  return getUsdcDenom(selectedNetworkId);
};

export const useSdlDenoms = (dependencies: typeof DEPENDENCIES = DEPENDENCIES) => {
  const usdcDenom = useUsdcDenom(dependencies);
  const supportsACT = dependencies.useSupportsACT();

  return useMemo(() => {
    if (supportsACT) {
      return [{ id: "uact", label: "uACT", tokenLabel: "ACT", value: "uact" }];
    }

    return [
      { id: "uakt", label: "uAKT", tokenLabel: "AKT", value: "uakt" },
      { id: "uusdc", label: "uUSDC", tokenLabel: "USDC", value: usdcDenom }
    ];
  }, [usdcDenom, supportsACT]);
};
