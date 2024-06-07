"use client";
import React, { ReactNode } from "react";
import { FormattedTime } from "react-intl";
import { Bin, Edit } from "iconoir-react";

import { Address } from "@src/components/shared/Address";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import { Button } from "@src/components/ui/button";
import { TableCell, TableRow } from "@src/components/ui/table";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { GrantType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";

type Props = {
  grant: GrantType;
  children?: ReactNode;
  onEditGrant: (grant: GrantType) => void;
  setDeletingGrant: (grant: GrantType) => void;
};

export const GranterRow: React.FunctionComponent<Props> = ({ grant, onEditGrant, setDeletingGrant }) => {
  const denomData = useDenomData(grant.authorization.spend_limit.denom);

  return (
    <TableRow className="[&>td]:px-2 [&>td]:py-1">
      <TableCell>
        <Address address={grant.grantee} isCopyable />
      </TableCell>
      <TableCell align="right">
        <AKTAmount uakt={coinToUDenom(grant.authorization.spend_limit)} /> {denomData?.label}
      </TableCell>
      <TableCell align="right">
        <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={grant.expiration} />
      </TableCell>
      <TableCell align="right">
        <Button variant="ghost" size="icon" onClick={() => onEditGrant(grant)}>
          <Edit />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setDeletingGrant(grant)} className="ml-2">
          <Bin />
        </Button>
      </TableCell>
    </TableRow>
  );
};
