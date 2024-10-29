"use client";
import React from "react";

import { useUsdcDenom } from "@src/hooks/useDenom";
import { useDepositParams } from "@src/queries/useSettings";
import { uAktDenom } from "@src/utils/constants";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { uaktToAKT } from "@src/utils/priceUtils";

type MinDeposit = {
  akt: number;
  usdc: number;
};

type ContextType = {
  minDeposit: MinDeposit;
};

const ChainParamContext = React.createContext<ContextType>({} as ContextType);

export const ChainParamProvider = ({ children }) => {
  const { data: depositParams } = useDepositParams({ enabled: false });
  const usdcDenom = useUsdcDenom();
  const aktMinDeposit = depositParams ? uaktToAKT(parseFloat(depositParams.find(x => x.denom === uAktDenom)?.amount || "") || 0) : 0;
  const usdcMinDeposit = depositParams ? udenomToDenom(parseFloat(depositParams.find(x => x.denom === usdcDenom)?.amount || "") || 0) : 0;
  const minDeposit = { akt: aktMinDeposit, usdc: usdcMinDeposit };

  return <ChainParamContext.Provider value={{ minDeposit }}>{children}</ChainParamContext.Provider>;
};

export function useChainParam() {
  return { ...React.useContext(ChainParamContext) };
}
