"use client";
import { ReactNode } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { useWallet } from "@src/context/WalletProvider";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { averageDaysInMonth } from "@src/utils/dateUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { averageBlockTime, getAvgCostPerMonth } from "@src/utils/priceUtils";
import { PriceValue } from "./PriceValue";

type Props = {
  value: number | string;
  denom: string;
  children?: ReactNode;
};

export const PriceEstimateTooltip: React.FunctionComponent<Props> = ({ value, denom }) => {
  const _value = udenomToDenom(typeof value === "string" ? parseFloat(value) : value, 10);
  const perDayValue = _value * (60 / averageBlockTime) * 60 * 24;
  const perMonthValue = _value * (60 / averageBlockTime) * 60 * 24 * averageDaysInMonth;
  const denomData = useDenomData(denom);
  const { isCustodial } = useWallet();

  return (
    <CustomTooltip
      title={
        <div>
          <span className="text-sm text-muted-foreground">Price estimation:</span>
          <div>
            <strong>
              <PriceValue value={_value} denom={denom} />
            </strong>
            &nbsp; per block (~{averageBlockTime}sec.)
          </div>

          <div>
            <strong>
              <PriceValue value={perDayValue} denom={denom} />
            </strong>
            &nbsp; per day
          </div>

          <div>
            <strong>
              <PriceValue value={perMonthValue} denom={denom} />
            </strong>
            &nbsp; per month
          </div>

          {isCustodial && <div className="mt-2 text-xs">({`~${udenomToDenom(getAvgCostPerMonth(value as number))} ${denomData?.label}/month`})</div>}
        </div>
      }
    >
      <InfoCircle className="ml-2 text-xs text-muted-foreground" />
    </CustomTooltip>
  );
};
