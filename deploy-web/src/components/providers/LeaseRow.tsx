import React from "react";
import { TableRow, TableCell, Box } from "@mui/material";
import { FormattedNumber } from "react-intl";
import isEqual from "lodash/isEqual";
import { makeStyles } from "tss-react/mui";
import { StatusPill } from "../shared/StatusPill";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { PricePerMonth } from "../shared/PricePerMonth";
import { getAvgCostPerMonth, uaktToAKT } from "@src/utils/priceUtils";
import { PriceEstimateTooltip } from "../shared/PriceEstimateTooltip";
import { CustomTableRow } from "../shared/CustomTable";
import { LeaseDto } from "@src/types/deployment";
import { useLocalNotes } from "@src/context/LocalNoteProvider";

const useStyles = makeStyles()(theme => ({
  flexCenter: {
    display: "flex",
    alignItems: "center"
  }
}));

type Props = {
  lease: LeaseDto;
};

const MemoLeaseRow: React.FunctionComponent<Props> = ({ lease }) => {
  const { classes } = useStyles();
  const { changeDeploymentName, getDeploymentData, getDeploymentName } = useLocalNotes();
  const deploymentName = getDeploymentName(lease.dseq);

  return (
    <CustomTableRow>
      <TableCell>
        <StatusPill state={lease.state} size="small" />
      </TableCell>
      <TableCell>
        <Link href={UrlService.deploymentDetails(lease.dseq)} passHref>
          <a>
            {lease.dseq}

            {deploymentName && (
              <Box component="span" fontWeight="normal">
                {" "}
                - {deploymentName}
              </Box>
            )}
          </a>
        </Link>
      </TableCell>
      <TableCell>
        <div className={classes.flexCenter}>
          <PricePerMonth perBlockValue={uaktToAKT(lease.price.amount, 6)} />
          <PriceEstimateTooltip value={lease.price.amount} />
        </div>
      </TableCell>
    </CustomTableRow>
  );
};

export const LeaseRow = React.memo(MemoLeaseRow, (prevProps, nextProps) => {
  return isEqual(prevProps, nextProps);
});
