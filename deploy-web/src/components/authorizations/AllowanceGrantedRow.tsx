"use client";
import React, { ReactNode } from "react";
import { FormattedTime } from "react-intl";
import { AllowanceType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";
import { getAllowanceTitleByType } from "@src/utils/grants";
import { TableCell, TableRow } from "@src/components/ui/table";
import { Address } from "@src/components/shared/Address";
import { AKTAmount } from "@src/components/shared/AKTAmount";

type Props = {
  allowance: AllowanceType;
  children?: ReactNode;
};

export const AllowanceGrantedRow: React.FunctionComponent<Props> = ({ allowance }) => {
  return (
    <TableRow>
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
