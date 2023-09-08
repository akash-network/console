import React, { ReactNode } from "react";
import { IconButton, TableCell } from "@mui/material";
import { CustomTableRow } from "../shared/CustomTable";
import { Address } from "../shared/Address";
import { FormattedTime } from "react-intl";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { coinToUDenom } from "@src/utils/priceUtils";
import { GrantType } from "@src/types/grant";
import { AKTAmount } from "../shared/AKTAmount";
import { useDenomData } from "@src/hooks/useWalletBalance";

type Props = {
  grant: GrantType;
  children?: ReactNode;
  onEditGrant: (grant: GrantType) => void;
  setDeletingGrant: (grant: GrantType) => void;
};

export const GranterRow: React.FunctionComponent<Props> = ({ children, grant, onEditGrant, setDeletingGrant }) => {
  const denomData = useDenomData(grant.authorization.spend_limit.denom);

  return (
    <CustomTableRow>
      <TableCell>
        <Address address={grant.grantee} isCopyable />
      </TableCell>
      <TableCell align="right">
        <AKTAmount uakt={coinToUDenom(grant.authorization.spend_limit)} /> {denomData?.label}
      </TableCell>
      <TableCell align="right">
        <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={grant.expiration} />
      </TableCell>
      <TableCell>
        <IconButton onClick={() => onEditGrant(grant)}>
          <EditIcon />
        </IconButton>
        <IconButton onClick={() => setDeletingGrant(grant)}>
          <DeleteIcon />
        </IconButton>
      </TableCell>
    </CustomTableRow>
  );
};
