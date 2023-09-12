import React, { ReactNode } from "react";
import { TableCell } from "@mui/material";
import { CustomTableRow } from "../shared/CustomTable";
import { Address } from "../shared/Address";
import { FormattedTime } from "react-intl";
import { AllowanceType } from "@src/types/grant";
import { AKTAmount } from "../shared/AKTAmount";
import { coinToUDenom } from "@src/utils/priceUtils";
import { getAllowanceTitleByType } from "@src/utils/grants";

type Props = {
  allowance: AllowanceType;
  children?: ReactNode;
};

export const AllowanceGrantedRow: React.FunctionComponent<Props> = ({ allowance }) => {
  // const denomData = useDenomData(grant.authorization.spend_limit.denom);

  return (
    <CustomTableRow>
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
    </CustomTableRow>
  );
};
