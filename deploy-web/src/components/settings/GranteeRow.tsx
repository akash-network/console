import React, { ReactNode } from "react";
import { TableCell } from "@mui/material";
import { CustomTableRow } from "../shared/CustomTable";
import { Address } from "../shared/Address";
import { FormattedTime } from "react-intl";
import { coinToUDenom } from "@src/utils/priceUtils";
import { GrantType } from "@src/types/grant";
import { AKTAmount } from "../shared/AKTAmount";
import { useDenomData } from "@src/hooks/useWalletBalance";

type Props = {
  grant: GrantType;
  children?: ReactNode;
};

export const GranteeRow: React.FunctionComponent<Props> = ({ grant }) => {
  const denomData = useDenomData(grant.authorization.spend_limit.denom);

  return (
    <CustomTableRow>
      <TableCell>
        <Address address={grant.granter} isCopyable />
      </TableCell>
      <TableCell align="right">
        <AKTAmount uakt={coinToUDenom(grant.authorization.spend_limit)} /> {denomData?.label}
      </TableCell>
      <TableCell align="right">
        <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={grant.expiration} />
      </TableCell>
    </CustomTableRow>
  );
};
