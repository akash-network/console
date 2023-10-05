import React from "react";
import { TableCell, Box } from "@mui/material";
import isEqual from "lodash/isEqual";
import { makeStyles } from "tss-react/mui";
import { StatusPill } from "../shared/StatusPill";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { PricePerMonth } from "../shared/PricePerMonth";
import { uaktToAKT } from "@src/utils/priceUtils";
import { PriceEstimateTooltip } from "../shared/PriceEstimateTooltip";
import { CustomTableRow } from "../shared/CustomTable";
import { LeaseDto } from "@src/types/deployment";
import { useLocalNotes } from "@src/context/LocalNoteProvider";

const useStyles = makeStyles()(() => ({
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
  const { getDeploymentName } = useLocalNotes();
  const deploymentName = getDeploymentName(lease.dseq);

  return (
    <CustomTableRow>
      <TableCell>
        <StatusPill state={lease.state} size="small" />
      </TableCell>
      <TableCell>
        <Link href={UrlService.deploymentDetails(lease.dseq)} passHref>
          {lease.dseq}
          {deploymentName && (
            <Box component="span" fontWeight="normal">
              {" "}
              - {deploymentName}
            </Box>
          )}
        </Link>
      </TableCell>
      <TableCell>
        <div className={classes.flexCenter}>
          <PricePerMonth denom={lease.price.denom} perBlockValue={uaktToAKT(parseFloat(lease.price.amount), 10)} />
          <PriceEstimateTooltip denom={lease.price.denom} value={lease.price.amount} />
        </div>
      </TableCell>
    </CustomTableRow>
  );
};

export const LeaseRow = React.memo(MemoLeaseRow, (prevProps, nextProps) => {
  return isEqual(prevProps, nextProps);
});
