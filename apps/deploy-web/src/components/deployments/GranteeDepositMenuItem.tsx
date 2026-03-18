"use client";
import type { ReactNode } from "react";
import React from "react";
import { FormattedDate } from "react-intl";
import { Address } from "@akashnetwork/ui/components";

import type { GrantType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";
import { DenomAmount } from "../shared/DenomAmount/DenomAmount";

type Props = {
  grant: GrantType;
  children?: ReactNode;
};

export const GranteeDepositMenuItem: React.FunctionComponent<Props> = ({ grant }) => {
  return (
    <div className="text-xs">
      <Address address={grant.granter} disableTooltip />
      &nbsp;<small className="text-muted-foreground">|</small>&nbsp;
      {grant.authorization.spend_limits.map(limit => (
        <DenomAmount key={limit.denom} amount={coinToUDenom(limit)} denom={limit.denom} />
      ))}
      &nbsp;
      <small className="text-muted-foreground">
        (Exp:&nbsp;
        <FormattedDate value={new Date(grant.expiration)} />)
      </small>
    </div>
  );
};
