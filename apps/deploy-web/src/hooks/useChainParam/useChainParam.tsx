import { useMemo } from "react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useDepositParams } from "@src/queries/useSaveSettings";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useSettings } from "../../context/SettingsProvider";

type MinDeposit = {
  akt: number;
  usdc: number;
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

  return useMemo(
    () => ({
      minDeposit: {
        akt: depositParams ? uaktToAKT(parseFloat(depositParams.find(x => x.denom === UAKT_DENOM)?.amount || "") || 0) : 0,
        usdc: depositParams ? udenomToDenom(parseFloat(depositParams.find(x => x.denom === usdcDenom)?.amount || "") || 0) : 0
      }
    }),
    [depositParams, usdcDenom]
  );
}
