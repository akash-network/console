import { useTheme } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import TableCell from "@mui/material/TableCell";
import { FormattedRelativeTime } from "react-intl";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { Block } from "@src/types";
import { Box, Typography } from "@mui/material";
import { getShortText } from "@src/hooks/useShortText";
import { CustomTableRow } from "../shared/CustomTable";

type Props = {
  errors?: string;
  block: Block;
};

const useStyles = makeStyles()(theme => ({}));

export const BlockRow: React.FunctionComponent<Props> = ({ block }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <CustomTableRow>
      <TableCell align="center">
        <Link href={UrlService.block(block.height)}>
          {block.height}
        </Link>
      </TableCell>
      <TableCell align="center">
        <Link href={UrlService.validator(block.proposer.operatorAddress)}>

          <Box component="span" className="text-truncate" sx={{ maxWidht: "150px" }}>
            {getShortText(block.proposer.moniker, 20)}
          </Box>

        </Link>
      </TableCell>
      <TableCell
        align="center"
        sx={{
          color: block.transactionCount > 0 && theme.palette.secondary.main,
          opacity: block.transactionCount > 0 ? 1 : 0.3,
          fontWeight: block.transactionCount > 0 && "bold"
        }}
      >
        {block.transactionCount}
      </TableCell>
      <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
        <Typography variant="caption">
          <FormattedRelativeTime
            value={(new Date(block.datetime).getTime() - new Date().getTime()) / 1000}
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
