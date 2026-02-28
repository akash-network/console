import { useMemo } from "react";

import { useUsdcDenom } from "@src/hooks/useDenom";
import { useDepositParams } from "@src/queries/useSaveSettings";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useSettings } from "../../context/SettingsProvider";

type MinDeposit = {
  akt: number;
  usdc: number;
  act: number;
};

type ContextType = {
  minDeposit: MinDeposit;
};

export const DEPENDENCIES = {
  useSettings,
  useDepositParams,
  useUsdcDenom
};

export function useChainParam({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): ContextType {
  const { isSettingsInit, settings } = d.useSettings();
  const { data: depositParams } = d.useDepositParams({
    enabled: isSettingsInit && !settings.isBlockchainDown
  });
  const usdcDenom = d.useUsdcDenom();

  return useMemo(() => {
    const minDeposit = (depositParams || []).reduce(
      (acc, param) => {
        acc[param.denom as keyof MinDeposit] = parseFloat(param.amount) || 0;
        return acc;
      },
      { akt: 0, usdc: 0, act: 0 }
    );

    return {
      minDeposit: {
        akt: uaktToAKT(minDeposit.akt),
        usdc: udenomToDenom(minDeposit.usdc),
        act: udenomToDenom(minDeposit.act)
      }
    };
  }, [depositParams, usdcDenom]);
}
