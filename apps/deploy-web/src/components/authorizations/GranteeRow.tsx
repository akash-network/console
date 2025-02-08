"use client";
import React, { ReactNode } from "react";
import { FormattedTime } from "react-intl";
import { Address, TableCell, TableRow } from "@akashnetwork/ui/components";

import { AKTAmount } from "@src/components/shared/AKTAmount";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { GrantType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";

type Props = {
  grant: GrantType;
  children?: ReactNode;
};

export const GranteeRow: React.FunctionComponent<Props> = ({ grant }) => {
  const limit = grant?.authorization?.spend_limit;
  const denomData = useDenomData(limit?.denom);

  return (
    <TableRow className="[&>td]:px-2 [&>td]:py-1">
      <TableCell>
        <Address address={grant.granter} isCopyable />
      </TableCell>
      <TableCell align="right">
        {limit ? (
          <>
            <AKTAmount uakt={coinToUDenom(limit)} /> {denomData?.label}
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
