import React from "react";
import { useEffect } from "react";
import { uAktDenom } from "@src/utils/constants";
import { useSettings } from "../SettingsProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useDepositParams } from "@src/queries/useSettings";
import { uaktToAKT } from "@src/utils/priceUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";

type MinDeposit = {
  akt: number;
  usdc: number;
};

type ContextType = {
  minDeposit: MinDeposit;
};

const ChainParamContext = React.createContext<ContextType>({} as ContextType);

export const ChainParamProvider = ({ children }) => {
  const { isSettingsInit } = useSettings();
  const { data: depositParams, refetch: getDepositParams } = useDepositParams({ enabled: false });
  const usdcDenom = useUsdcDenom();
  const aktMinDeposit = depositParams ? uaktToAKT(parseFloat(depositParams.find(x => x.denom === uAktDenom)?.amount) || 0) : null;
  const usdcMinDeposit = depositParams ? udenomToDenom(parseFloat(depositParams.find(x => x.denom === usdcDenom)?.amount) || 0) : null;
  const minDeposit = { akt: aktMinDeposit, usdc: usdcMinDeposit };

  useEffect(() => {
    if (isSettingsInit && !depositParams) {
      getDepositParams();
    }
  }, [isSettingsInit, depositParams]);

  return <ChainParamContext.Provider value={{ minDeposit }}>{children}</ChainParamContext.Provider>;
};

// Hook
export function useChainParam() {
  return { ...React.useContext(ChainParamContext) };
}
