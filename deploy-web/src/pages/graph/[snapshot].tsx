import React, { useState } from "react";
import { FormattedNumber } from "react-intl";
import { SelectedRange } from "@src/utils/constants";
import { urlParamToSnapshot } from "@src/utils/snapshotsUrlHelpers";
import { ISnapshotMetadata, Snapshots, SnapshotsUrlParam } from "@src/types";
import { useGraphSnapshot } from "@src/queries/useGraphQuery";
import { percIncrease, udenomToDenom } from "@src/utils/mathHelpers";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { DiffPercentageChip } from "@src/components/shared/DiffPercentageChip";
import { DiffNumber } from "@src/components/shared/DiffNumber";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import dynamic from "next/dynamic";
import { makeStyles } from "tss-react/mui";
import { GradientText } from "@src/components/shared/GradientText";
import { bytesToShrink } from "@src/utils/unitUtils";
import { NextSeo } from "next-seo";
import { parseAsync } from "json2csv";
import DownloadIcon from "@mui/icons-material/Download";
import { uaktToAKT } from "@src/utils/priceUtils";
import { TimeRange } from "@src/components/shared/TimeRange";

const Graph = dynamic(() => import("../../components/graph/Graph"), {
  ssr: false
});

export const useStyles = makeStyles()(theme => ({
  root: {
    maxWidth: "800px",
    margin: "auto"
  },
  loading: { textAlign: "center", marginTop: "4rem", marginBottom: "1rem" },
  title: {
    fontSize: "2rem",
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

export interface IGraphProps {
  snapshot: string;
}

export const GraphPage: React.FunctionComponent<IGraphProps> = ({ snapshot: snapshotUrlParam }) => {
  const [selectedRange, setSelectedRange] = useState(SelectedRange["7D"]);
  const snapshot = urlParamToSnapshot(snapshotUrlParam as SnapshotsUrlParam);
  const { data: snapshotData, status } = useGraphSnapshot(snapshot);
  const { classes } = useStyles();
  const title = getTitle(snapshot as Snapshots);
  const snapshotMetadata = snapshotData && getSnapshotMetadata(snapshot as Snapshots);
  const rangedData = snapshotData && snapshotData.snapshots.slice(Math.max(snapshotData.snapshots.length - selectedRange, 0), snapshotData.snapshots.length);
  const metric = snapshotData && snapshotMetadata.unitFn(snapshotData.currentValue);
  const metricDiff = snapshotData && snapshotMetadata.unitFn(snapshotData.currentValue - snapshotData.compareValue);

  async function onDownloadCSVClick() {
    const csvContent = await parseAsync(
      rangedData.map(d => ({ date: d.date, value: snapshotMetadata.unitFn(d.value).value })),
      {
        fields: [
          {
            label: "Date",
            value: "date"
          },
          {
            label: "Value" + (snapshotMetadata.legend ? ` (${snapshotMetadata.legend})` : ""),
            value: "value"
          }
        ]
      }
    );

    const datePart = new Date().toISOString().substring(0, 10).replaceAll("-", "");
    const rangePart = Object.keys(SelectedRange).find(key => SelectedRange[key] === selectedRange);
    const fileName = `${snapshotUrlParam}-${datePart}-${rangePart}.csv`;

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link); // Required for FF

    link.click();
  }

  return (
    <Layout>
      <NextSeo title={title} />

      <PageContainer sx={{ padding: { xs: "0 .5rem" } }}>
        <div className={classes.root}>
          <Box sx={{ marginBottom: "2rem" }}>
            <Button component={Link} href={UrlService.analytics()} startIcon={<ArrowBackIcon />}>
              Back
            </Button>
          </Box>

          <Box sx={{ marginBottom: 1 }}>
            <Typography variant="h1" className={classes.title}>
              <GradientText>{title}</GradientText>
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
                snapshot={snapshot}
                snapshotData={snapshotData}
                selectedRange={selectedRange}
              />
              {snapshotData && (
                <Box textAlign="right">
                  <Button variant="outlined" color="secondary" onClick={onDownloadCSVClick}>
                    <DownloadIcon />
                    &nbsp;Download .CSV
                  </Button>
                </Box>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </Layout>
  );
};

const getSnapshotMetadata = (snapshot: Snapshots): { unitFn: (number) => ISnapshotMetadata; legend?: string } => {
  switch (snapshot) {
    case Snapshots.dailyUAktSpent:
    case Snapshots.totalUAktSpent:
    case Snapshots.dailyUUsdcSpent:
    case Snapshots.totalUUsdcSpent:
      return { unitFn: x => ({ value: udenomToDenom(x) }) };
    case Snapshots.activeCPU:
      return {
        unitFn: x => ({ value: x / 1000 })
      };
    case Snapshots.activeGPU:
      return {
        unitFn: x => ({ value: x })
      };
    case Snapshots.activeMemory:
    case Snapshots.activeStorage:
      return {
        unitFn: x => {
          const _ = bytesToShrink(x);
          return {
            value: x / 1000 / 1000 / 1000,
            unit: _.unit,
            modifiedValue: _.value
          };
        },
        legend: "GB"
      };

    default:
      return {
        unitFn: x => ({ value: x })
      };
  }
};

const getTitle = (snapshot: Snapshots): string => {
  switch (snapshot) {
    case Snapshots.activeLeaseCount:
      return "Active leases";
    case Snapshots.totalUAktSpent:
      return "Total AKT spent";
    case Snapshots.totalUUsdcSpent:
      return "Total USDC spent";
    case Snapshots.totalLeaseCount:
      return "All-time lease count";
    case Snapshots.activeCPU:
      return "CPU leased";
    case Snapshots.activeGPU:
      return "GPU leased";
    case Snapshots.activeMemory:
      return "Memory leased";
    case Snapshots.activeStorage:
      return "Disk storage leased";
    case Snapshots.dailyUAktSpent:
      return "Daily AKT spent";
    case Snapshots.dailyUUsdcSpent:
      return "Daily USDC spent";
    case Snapshots.dailyLeaseCount:
      return "Daily new leases";

    default:
      return "Graph not found.";
  }
};

export async function getServerSideProps({ params }) {
  return {
    props: {
      snapshot: params?.snapshot
    }
  };
}

export default GraphPage;
