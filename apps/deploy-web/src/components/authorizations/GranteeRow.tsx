"use client";
import type { ReactNode } from "react";
import React from "react";
import { FormattedTime } from "react-intl";
import { Address, TableCell, TableRow } from "@akashnetwork/ui/components";

import type { GrantType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";
import { DenomAmount } from "../shared/DenomAmount/DenomAmount";

type Props = {
  grant: GrantType;
  children?: ReactNode;
};

export const GranteeRow: React.FunctionComponent<Props> = ({ grant }) => {
  const limit = grant?.authorization?.spend_limit;

  return (
    <TableRow className="[&>td]:px-2 [&>td]:py-1">
      <TableCell>
        <Address address={grant.granter} isCopyable />
      </TableCell>
      <TableCell align="right">
        {limit ? (
          <>
            <DenomAmount amount={coinToUDenom(limit)} denom={limit.denom} />
          </>
        ) : (
          <span>Unlimited</span>
        )}
      </TableCell>
      <TableCell align="right">
        <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={grant.expiration} />
      </TableCell>
    </TableRow>
  );
};
