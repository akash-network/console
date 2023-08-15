import React, { useState } from "react";
import { FormattedNumber } from "react-intl";
import { SelectedRange } from "@src/utils/constants";
import { ProviderSnapshots } from "@src/types";
import { percIncrease } from "@src/utils/mathHelpers";
import { Box, CircularProgress, Typography } from "@mui/material";
import { DiffPercentageChip } from "@src/components/shared/DiffPercentageChip";
import { DiffNumber } from "@src/components/shared/DiffNumber";
import dynamic from "next/dynamic";
import { makeStyles } from "tss-react/mui";
import { getSnapshotMetadata } from "@src/utils/providerUtils";
import { useProviderActiveLeasesGraph } from "@src/queries/useProvidersQuery";
import { ProviderDetail } from "@src/types/provider";
import { TimeRange } from "../shared/TimeRange";

const Graph = dynamic(() => import("../../components/graph/Graph"), {
  ssr: false
});

export const useStyles = makeStyles()(theme => ({
  root: {
    maxWidth: "800px",
    margin: "auto",
    padding: "1rem 0"
  },
  loading: { textAlign: "center", marginTop: "4rem", marginBottom: "1rem" },
  title: {
    fontSize: "1rem",
    fontWeight: "normal",
    [theme.breakpoints.down("sm")]: {
      textAlign: "center"
    }
  },
  subTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1rem",
    [theme.breakpoints.down("sm")]: {
      flexWrap: "wrap",
      flexDirection: "column"
    }
  },
  subTitleValues: {
    [theme.breakpoints.down("sm")]: {
      flexBasis: "100%",
      marginBottom: "1rem"
    }
  },
  titleValue: {
    fontSize: "2rem",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    [theme.breakpoints.down("sm")]: {
      justifyContent: "center"
    }
  },
  diffNumber: {
    fontSize: ".7rem",
    fontWeight: "lighter"
  }
}));

interface IProps {
  provider: Partial<ProviderDetail>;
}

export const ActiveLeasesGraph: React.FunctionComponent<IProps> = ({ provider }) => {
  const { data: snapshotData, status } = useProviderActiveLeasesGraph(provider.owner);
  const [selectedRange, setSelectedRange] = useState(SelectedRange["7D"]);
  const { classes } = useStyles();
  const snapshotMetadata = snapshotData && getSnapshotMetadata();
  const rangedData = snapshotData && snapshotData.snapshots.slice(Math.max(snapshotData.snapshots.length - selectedRange, 0), snapshotData.snapshots.length);
  const metric = snapshotData && snapshotMetadata.unitFn(snapshotData.currentValue);
  const metricDiff = snapshotData && snapshotMetadata.unitFn(snapshotData.currentValue - snapshotData.compareValue);

  return (
    <Box className={classes.root}>
      <Box sx={{ marginBottom: 1 }}>
        <Typography variant="h1" className={classes.title}>
          Active Leases&nbsp;
          {provider.name && (
            <Typography variant="caption" color="textSecondary">
              ({provider.name})
            </Typography>
          )}
        </Typography>
      </Box>

      {!snapshotData && status === "loading" && (
        <div className={classes.loading}>
          <CircularProgress size={80} color="secondary" />
        </div>
      )}

      {snapshotData && (
        <>
          <Box className={classes.subTitle}>
            <Box className={classes.subTitleValues}>
              <Typography variant="h3" className={classes.titleValue}>
                <FormattedNumber value={metric.modifiedValue || metric.value} maximumFractionDigits={2} />
                &nbsp;{metric.unit}&nbsp;
                <DiffPercentageChip value={percIncrease(snapshotData.compareValue, snapshotData.currentValue)} size="medium" />
                &nbsp;
                <DiffNumber value={metricDiff.modifiedValue || metricDiff.value} unit={metricDiff.unit} className={classes.diffNumber} />
              </Typography>
            </Box>

            <TimeRange selectedRange={selectedRange} onRangeChange={setSelectedRange} />
          </Box>
          <Graph
            rangedData={rangedData}
            snapshotMetadata={snapshotMetadata}
            snapshot={ProviderSnapshots.count}
            snapshotData={snapshotData}
            selectedRange={selectedRange}
          />
        </>
      )}
    </Box>
  );
};
