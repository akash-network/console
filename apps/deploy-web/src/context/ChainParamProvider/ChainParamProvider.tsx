"use client";
import React from "react";
import { useEffect } from "react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useDepositParams } from "@src/queries/useSettings";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";
import { useSettings } from "../SettingsProvider";

type MinDeposit = {
  akt: number;
  usdc: number;
};

type ContextType = {
  minDeposit: MinDeposit;
};

const ChainParamContext = React.createContext<ContextType>({} as ContextType);

export const ChainParamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSettingsInit } = useSettings();
  const { data: depositParams, refetch: getDepositParams } = useDepositParams({ enabled: false });
  const usdcDenom = useUsdcDenom();
  const aktMinDeposit = depositParams ? uaktToAKT(parseFloat(depositParams.find(x => x.denom === UAKT_DENOM)?.amount || "") || 0) : 0;
  const usdcMinDeposit = depositParams ? udenomToDenom(parseFloat(depositParams.find(x => x.denom === usdcDenom)?.amount || "") || 0) : 0;
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
