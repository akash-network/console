"use client";
import React, { ReactNode } from "react";
import { FormattedTime } from "react-intl";
import { coinToUDenom } from "@src/utils/priceUtils";
import { GrantType } from "@src/types/grant";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { TableCell, TableRow } from "@src/components/ui/table";
import { Address } from "@src/components/shared/Address";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import { Button } from "@src/components/ui/button";
import { Bin, Edit } from "iconoir-react";

type Props = {
  grant: GrantType;
  children?: ReactNode;
  onEditGrant: (grant: GrantType) => void;
  setDeletingGrant: (grant: GrantType) => void;
};

export const GranterRow: React.FunctionComponent<Props> = ({ children, grant, onEditGrant, setDeletingGrant }) => {
  const denomData = useDenomData(grant.authorization.spend_limit.denom);

  return (
    <TableRow>
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
