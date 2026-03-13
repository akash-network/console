import { useMemo } from "react";

import { useUsdcDenom } from "@src/hooks/useDenom";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import { useDepositParams } from "@src/queries/useSaveSettings";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useSettings } from "../../context/SettingsProvider";

type MinDeposit =
  | {
      akt: number;
      usdc: number;
    }
  | {
      act: number;
    };

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
  const { data: depositParams } = d.useDepositParams({
    enabled: isSettingsInit && !settings.isBlockchainDown
  });
  const usdcDenom = d.useUsdcDenom();
  const supportsACT = d.useSupportsACT();

  return useMemo(() => {
    const byDenom = Object.fromEntries((depositParams || []).map(p => [p.denom, parseFloat(p.amount) || 0]));

    return {
      minDeposit: supportsACT
        ? { act: udenomToDenom(byDenom.uact ?? 0) }
        : { akt: udenomToDenom(byDenom.uakt ?? 0), usdc: udenomToDenom(byDenom[usdcDenom] ?? 0) }
    };
  }, [depositParams, usdcDenom, supportsACT]);
}
