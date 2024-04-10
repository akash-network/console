"use client";
import React, { ReactNode } from "react";
import { FormattedTime } from "react-intl";
import { AllowanceType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";
import { getAllowanceTitleByType } from "@src/utils/grants";
import { TableCell, TableRow } from "@src/components/ui/table";
import { Address } from "@src/components/shared/Address";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import { Button } from "@src/components/ui/button";
import { Bin, Edit } from "iconoir-react";

type Props = {
  allowance: AllowanceType;
  children?: ReactNode;
  onEditAllowance: (allowance: AllowanceType) => void;
  setDeletingAllowance: (grantallowance: AllowanceType) => void;
};

export const AllowanceIssuedRow: React.FunctionComponent<Props> = ({ allowance, onEditAllowance, setDeletingAllowance }) => {
  return (
    <TableRow>
      <TableCell>{getAllowanceTitleByType(allowance)}</TableCell>
      <TableCell>
        <Address address={allowance.grantee} isCopyable />
      </TableCell>
      <TableCell align="right">
        <AKTAmount uakt={coinToUDenom(allowance.allowance.spend_limit[0])} /> AKT
      </TableCell>
      <TableCell align="right">
        <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={allowance.allowance.expiration} />
      </TableCell>
      <TableCell align="right">
        <Button onClick={() => onEditAllowance(allowance)} variant="ghost" size="icon">
          <Edit />
        </Button>
        <Button onClick={() => setDeletingAllowance(allowance)} variant="ghost" size="icon" className="ml-2">
          <Bin />
        </Button>
      </TableCell>
    </TableRow>
  );
};
