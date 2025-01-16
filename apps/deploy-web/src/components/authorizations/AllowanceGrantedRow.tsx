"use client";
import React, { ReactNode } from "react";
import { FormattedTime } from "react-intl";
import { Address, Checkbox, TableCell, TableRow } from "@akashnetwork/ui/components";

import { AKTAmount } from "@src/components/shared/AKTAmount";
import { AllowanceType } from "@src/types/grant";
import { getAllowanceTitleByType } from "@src/utils/grants";
import { coinToUDenom } from "@src/utils/priceUtils";

type Props = {
  allowance: AllowanceType;
  children?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
};

export const AllowanceGrantedRow: React.FunctionComponent<Props> = ({ allowance, selected, onSelect }) => {
  const limit = allowance?.allowance?.spend_limit?.[0];
  return (
    <TableRow className="[&>td]:px-2 [&>td]:py-1">
      <TableCell>
        <Checkbox className="ml-2" checked={selected} onCheckedChange={typeof onSelect === "function" ? checked => checked && onSelect() : undefined} />
      </TableCell>
      <TableCell>{getAllowanceTitleByType(allowance)}</TableCell>
      <TableCell>{allowance.granter && <Address address={allowance.granter} isCopyable />}</TableCell>
      <TableCell>
        {limit ? (
          <>
            <AKTAmount uakt={coinToUDenom(limit)} /> AKT
          </>
        ) : (
          <span>Unlimited</span>
        )}
      </TableCell>
      <TableCell align="right">{<FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={allowance.allowance.expiration} />}</TableCell>
    </TableRow>
  );
};
