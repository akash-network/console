"use client";
import type { ReactNode } from "react";
import React from "react";
import { FormattedDate } from "react-intl";
import { Address } from "@akashnetwork/ui/components";

import { useDenomData } from "@src/hooks/useWalletBalance";
import type { GrantType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";
import { AKTAmount } from "../shared/AKTAmount";

type Props = {
  grant: GrantType;
  children?: ReactNode;
};

export const GranteeDepositMenuItem: React.FunctionComponent<Props> = ({ grant }) => {
  const denomData = useDenomData(grant.authorization.spend_limit.denom);

  return (
    <div className="text-xs">
      <Address address={grant.granter} disableTooltip />
      &nbsp;<small className="text-muted-foreground">|</small>&nbsp;
      <AKTAmount uakt={coinToUDenom(grant.authorization.spend_limit)} />
      &nbsp;
      {denomData?.label}
      &nbsp;
      <small className="text-muted-foreground">
        (Exp:&nbsp;
        <FormattedDate value={new Date(grant.expiration)} />)
      </small>
    </div>
  );
};
