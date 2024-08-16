"use client";
import React, { ReactNode } from "react";
import { FormattedTime } from "react-intl";
import { Address, Button, Checkbox, TableCell, TableRow } from "@akashnetwork/ui/components";
import { Bin, Edit } from "iconoir-react";

import { AKTAmount } from "@src/components/shared/AKTAmount";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { GrantType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";

type Props = {
  grant: GrantType;
  children?: ReactNode;
  checked?: boolean;
  onSelectGrant: (isChecked: boolean, grant: GrantType) => void;
  onEditGrant: (grant: GrantType) => void;
  setDeletingGrant: (grant: GrantType) => void;
};

export const GranterRow: React.FunctionComponent<Props> = ({ grant, onEditGrant, setDeletingGrant, checked, onSelectGrant }) => {
  const denomData = useDenomData(grant.authorization.spend_limit.denom);

  return (
    <TableRow className="[&>td]:px-2 [&>td]:py-1">
      <TableCell>
        <Address address={grant.grantee} isCopyable />
      </TableCell>
      <TableCell align="center">
        <AKTAmount uakt={coinToUDenom(grant.authorization.spend_limit)} /> {denomData?.label}
      </TableCell>
      <TableCell align="center">
        <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={grant.expiration} />
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
                onSelectGrant(value as boolean, grant);
              }}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => onEditGrant(grant)}>
            <Edit className="text-xs" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeletingGrant(grant)}>
            <Bin className="text-xs" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
