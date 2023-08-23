import { makeStyles } from "tss-react/mui";
import TableContainer from "@mui/material/TableContainer";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Table from "@mui/material/Table";
import { IDelegationDetail } from "@src/types/address";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { Box } from "@mui/material";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { CustomTableHeader, CustomTableRow } from "../shared/CustomTable";
import { getShortText } from "@src/hooks/useShortText";
import { AKTAmount } from "../shared/AKTAmount";

type Props = {
  delegations: IDelegationDetail[];
};

const useStyles = makeStyles()(theme => ({}));

export const Delegations: React.FunctionComponent<Props> = ({ delegations }) => {
  const { classes } = useStyles();

  return delegations.length === 0 ? (
    <Box sx={{ padding: "1rem", display: "flex", alignItems: "center" }}>
      <SearchOffIcon />
      &nbsp; No delegations
    </Box>
  ) : (
    <TableContainer>
      <Table size="small">
        <CustomTableHeader>
          <TableRow>
            <TableCell>Validator</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right">Reward</TableCell>
          </TableRow>
        </CustomTableHeader>

        <TableBody>
          {delegations.map(delegation => (
            <CustomTableRow key={delegation.validator.operatorAddress}>
              <TableCell>
                <Link href={UrlService.validator(delegation.validator.operatorAddress)}>{getShortText(delegation.validator.moniker, 20)}</Link>
              </TableCell>
              <TableCell align="right">
                <AKTAmount uakt={delegation.amount} showAKTLabel />
              </TableCell>
              <TableCell align="right">
                <AKTAmount uakt={delegation.reward} showAKTLabel />
              </TableCell>
            </CustomTableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
