import { useTheme } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import TableCell from "@mui/material/TableCell";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { BlockTransaction } from "@src/types";
import { getSplitText } from "@src/hooks/useShortText";
import { useFriendlyMessageType } from "@src/hooks/useFriendlyMessageType";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { FormattedRelativeTime } from "react-intl";
import { AKTAmount } from "../shared/AKTAmount";
import { CustomTableRow } from "../shared/CustomTable";

type Props = {
  errors?: string;
  isSimple?: boolean;
  blockHeight: number;
  transaction: BlockTransaction;
};

const useStyles = makeStyles()(theme => ({}));

export const TransactionRow: React.FunctionComponent<Props> = ({ transaction, blockHeight, isSimple }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const txHash = getSplitText(transaction.hash, 6, 6);
  const firstMessageType = transaction.messages[0].isReceiver ? "Receive" : useFriendlyMessageType(transaction.messages[0].type);

  return (
    <CustomTableRow>
      <TableCell>
        <Link href={UrlService.transaction(transaction.hash)} target="_blank">
          {txHash}
        </Link>
      </TableCell>
      <TableCell align="center">
        <Chip
          label={firstMessageType}
          size="small"
          color="secondary"
          sx={{ height: "1rem", fontSize: ".75rem", maxWidth: "120px" }}
          className="text-truncate"
        />
        <Typography variant="caption">{transaction.messages.length > 1 ? " +" + (transaction.messages.length - 1) : ""}</Typography>
      </TableCell>
      {!isSimple && (
        <>
          <TableCell align="center">{transaction.isSuccess ? "Success" : "Failed"}</TableCell>
          <TableCell align="center">{transaction.messages[0].amount && <AKTAmount uakt={transaction.messages[0].amount} showAKTLabel />}</TableCell>
          <TableCell align="center">
            <AKTAmount uakt={transaction.fee} showAKTLabel />
          </TableCell>
        </>
      )}
      <TableCell align="center">
        <Link href={UrlService.block(blockHeight)}>
          {blockHeight}
        </Link>
      </TableCell>
      <TableCell align="center">
        <Typography variant="caption">
          <FormattedRelativeTime
            value={(new Date(transaction.datetime).getTime() - new Date().getTime()) / 1000}
            numeric="auto"
            unit="second"
            style="short"
            updateIntervalInSeconds={7}
          />
        </Typography>
      </TableCell>
    </CustomTableRow>
  );
};
