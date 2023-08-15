import { makeStyles } from "tss-react/mui";
import TableContainer from "@mui/material/TableContainer";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Table from "@mui/material/Table";
import { IRedelegationDetail } from "@src/types/address";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { Box } from "@mui/material";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { FormattedRelativeTime } from "react-intl";
import { CustomTableHeader, CustomTableRow } from "../shared/CustomTable";
import { getShortText } from "@src/hooks/useShortText";
import { AKTAmount } from "../shared/AKTAmount";

type Props = {
  redelegations: IRedelegationDetail[];
};

const useStyles = makeStyles()(theme => ({}));

export const Redelegations: React.FunctionComponent<Props> = ({ redelegations }) => {
  const { classes } = useStyles();

  return redelegations.length === 0 ? (
    <Box sx={{ padding: "1rem", display: "flex", alignItems: "center" }}>
      <SearchOffIcon />
      &nbsp; No redelegations
    </Box>
  ) : (
    <TableContainer>
      <Table size="small">
        <CustomTableHeader>
          <TableRow>
            <TableCell>From</TableCell>
            <TableCell>To</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="right">Time</TableCell>
          </TableRow>
        </CustomTableHeader>

        <TableBody>
          {redelegations.map(redelegation => (
            <CustomTableRow key={`${redelegation.srcAddress.operatorAddress}_${redelegation.dstAddress.operatorAddress}`}>
              <TableCell>
                <Link href={UrlService.validator(redelegation.srcAddress.operatorAddress)}>
                  <a>{getShortText(redelegation.srcAddress.moniker, 20)}</a>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={UrlService.validator(redelegation.dstAddress.operatorAddress)}>
                  <a>{getShortText(redelegation.dstAddress.moniker, 20)}</a>
                </Link>
              </TableCell>
              <TableCell align="right">
                <AKTAmount uakt={redelegation.amount} showAKTLabel />
              </TableCell>
              <TableCell align="right">
                <FormattedRelativeTime
                  value={(new Date(redelegation.completionTime).getTime() - new Date().getTime()) / 1000}
                  numeric="always"
                  unit="second"
                  style="narrow"
                  updateIntervalInSeconds={7}
                />
              </TableCell>
            </CustomTableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
