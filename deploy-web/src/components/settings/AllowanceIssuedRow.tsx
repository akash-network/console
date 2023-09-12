import React, { ReactNode } from "react";
import { IconButton, TableCell } from "@mui/material";
import { CustomTableRow } from "../shared/CustomTable";
import { Address } from "../shared/Address";
import { FormattedTime } from "react-intl";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { AllowanceType } from "@src/types/grant";
import { AKTAmount } from "../shared/AKTAmount";
import { coinToUDenom } from "@src/utils/priceUtils";

type Props = {
  allowance: AllowanceType;
  children?: ReactNode;
  onEditAllowance: (allowance: AllowanceType) => void;
  setDeletingAllowance: (grantallowance: AllowanceType) => void;
};

export const AllowanceIssuedRow: React.FunctionComponent<Props> = ({ allowance, onEditAllowance, setDeletingAllowance }) => {
  // const denomData = useDenomData(grant.authorization.spend_limit.denom);

  return (
    <CustomTableRow>
      <TableCell>{allowance.allowance["@type"]}</TableCell>
      <TableCell>
        <Address address={allowance.grantee} isCopyable />
      </TableCell>
      <TableCell align="right">
        <AKTAmount uakt={coinToUDenom(allowance.allowance.spend_limit[0])} /> AKT
      </TableCell>
      <TableCell align="right">
        <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={allowance.allowance.expiration} />
      </TableCell>
      <TableCell>
        <IconButton onClick={() => onEditAllowance(allowance)}>
          <EditIcon />
        </IconButton>
        <IconButton onClick={() => setDeletingAllowance(allowance)}>
          <DeleteIcon />
        </IconButton>
      </TableCell>
    </CustomTableRow>
  );
};
