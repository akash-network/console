"use client";
import type { FC } from "react";

import { useUsdcDenom } from "@src/hooks/useDenom";

type Props = {
  denom: string;
};

export const DenomLabel: FC<Props> = ({ denom }) => {
  const usdcDenom = useUsdcDenom();
  const label = denom === usdcDenom ? "USDC" : denom.toUpperCase().replace("U", "");
  return <span className="ml-1 text-sm font-normal">{label}</span>;
};
