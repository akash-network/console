"use client";
import React, { ReactNode } from "react";
import { FormattedTime } from "react-intl";
import { Address, Button, Checkbox, TableCell, TableRow } from "@akashnetwork/ui/components";
import { Bin, Edit } from "iconoir-react";

import { AKTAmount } from "@src/components/shared/AKTAmount";
import { AllowanceType } from "@src/types/grant";
import { getAllowanceTitleByType } from "@src/utils/grants";
import { coinToUDenom } from "@src/utils/priceUtils";

type Props = {
  allowance: AllowanceType;
  children?: ReactNode;
  checked?: boolean;
  onEditAllowance: (allowance: AllowanceType) => void;
  setDeletingAllowance: (grantallowance: AllowanceType) => void;
  onSelectAllowance: (isChecked: boolean, allowance: AllowanceType) => void;
};

export const AllowanceIssuedRow: React.FunctionComponent<Props> = ({ allowance, checked, onEditAllowance, setDeletingAllowance, onSelectAllowance }) => {
  const limit = allowance?.allowance?.spend_limit?.[0];

  return (
    <TableRow className="[&>td]:px-2 [&>td]:py-1">
      <TableCell>{getAllowanceTitleByType(allowance)}</TableCell>
      <TableCell align="center">
        <Address address={allowance.grantee} isCopyable />
      </TableCell>
      <TableCell align="center">
        {limit ? (
          <>
            <AKTAmount uakt={coinToUDenom(limit)} /> AKT
          </>
        ) : (
          <span>Unlimited</span>
        )}
      </TableCell>
      <TableCell align="center">
        <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={allowance.allowance.expiration} />
      </TableCell>
      <TableCell align="center">
        <div className="flex items-center justify-end space-x-2">
          <div className="flex w-[40px] items-center justify-center">
            <Checkbox
              checked={checked}
              onClick={event => {
                event.stopPropagation();
              }}
              onCheckedChange={value => {
                onSelectAllowance(value as boolean, allowance);
              }}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => onEditAllowance(allowance)}>
            <Edit className="text-xs" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeletingAllowance(allowance)}>
            <Bin className="text-xs" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
