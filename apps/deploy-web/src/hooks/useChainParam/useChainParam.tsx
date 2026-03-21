import { useMemo } from "react";

import { useUsdcDenom } from "@src/hooks/useDenom";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import { useDepositParams } from "@src/queries/useSaveSettings";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useSettings } from "../../context/SettingsProvider";

type MinDeposit = {
  akt: number;
  usdc: number;
  act: number;
};

export type MinDepositDenom = keyof MinDeposit;

type ContextType = {
  minDeposit: MinDeposit;
};

export const DEPENDENCIES = {
  useSettings,
  useDepositParams,
  useUsdcDenom,
  useSupportsACT
};

export function useChainParam({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): ContextType {
  const { isSettingsInit, settings } = d.useSettings();
  const supportsACT = d.useSupportsACT();
  const { data: depositParams } = d.useDepositParams({
    enabled: isSettingsInit && !settings.isBlockchainDown,
    supportsACT
  });
  const usdcDenom = d.useUsdcDenom();

  return useMemo(() => {
    const minDeposit = (depositParams || []).reduce(
      (acc, param) => {
        acc[param.denom] = parseFloat(param.amount) || 0;
        return acc;
      },
      { uakt: 0, [usdcDenom]: 0, uact: 0 }
    );

    return {
      minDeposit: {
        akt: udenomToDenom(minDeposit.uakt),
        usdc: udenomToDenom(minDeposit[usdcDenom]),
        act: udenomToDenom(minDeposit.uact)
      }
    };
  }, [depositParams, usdcDenom]);
}
