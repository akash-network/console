"use client";
import React, { ReactNode } from "react";
import { FormattedTime } from "react-intl";

import { Address } from "@src/components/shared/Address";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import { TableCell, TableRow } from "@src/components/ui/table";
import { AllowanceType } from "@src/types/grant";
import { getAllowanceTitleByType } from "@src/utils/grants";
import { coinToUDenom } from "@src/utils/priceUtils";

type Props = {
  allowance: AllowanceType;
  children?: ReactNode;
};

export const AllowanceGrantedRow: React.FunctionComponent<Props> = ({ allowance }) => {
  return (
    <TableRow className="[&>td]:px-2 [&>td]:py-1">
      <TableCell>{getAllowanceTitleByType(allowance)}</TableCell>
      <TableCell>
        <Address address={allowance.granter} isCopyable />
      </TableCell>
      <TableCell>
        <AKTAmount uakt={coinToUDenom(allowance.allowance.spend_limit[0])} /> AKT
      </TableCell>
      <TableCell align="right">
        <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={allowance.allowance.expiration} />
      </TableCell>
    </TableRow>
  );
};
