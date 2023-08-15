import React, { useState } from "react";
import { FormattedNumber } from "react-intl";
import { SelectedRange } from "@src/utils/constants";
import { urlParamToProviderSnapshot } from "@src/utils/snapshotsUrlHelpers";
import { ProviderSnapshots, ProviderSnapshotsUrlParam } from "@src/types";
import { useProviderGraphSnapshot } from "@src/queries/useGraphQuery";
import { percIncrease } from "@src/utils/mathHelpers";
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
import { NextSeo } from "next-seo";
import { parseAsync } from "json2csv";
import { useCustomUser } from "@src/hooks/useCustomUser";
import DownloadIcon from "@mui/icons-material/Download";
import { getSnapshotMetadata } from "@src/utils/providerUtils";
import { TimeRange } from "@src/components/shared/TimeRange";

const Graph = dynamic(() => import("../../components/graph/Graph"), {
  ssr: false
});

const useStyles = makeStyles()(theme => ({
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

interface IGraphProps {
  snapshot: string;
}

const ProviderGraphPage: React.FunctionComponent<IGraphProps> = ({ snapshot: snapshotUrlParam }) => {
  const { user, isLoading: isLoadingUser } = useCustomUser();
  const [selectedRange, setSelectedRange] = useState(SelectedRange["7D"]);
  const snapshot = urlParamToProviderSnapshot(snapshotUrlParam as ProviderSnapshotsUrlParam);
  const { data: snapshotData, status } = useProviderGraphSnapshot(snapshot);
  const { classes } = useStyles();
  const title = getTitle(snapshot as ProviderSnapshots);
  const snapshotMetadata = snapshotData && getSnapshotMetadata(snapshot as ProviderSnapshots);
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
            <Link href={UrlService.analytics()} passHref>
              <Button startIcon={<ArrowBackIcon />}>Back</Button>
            </Link>
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

const getTitle = (snapshot: ProviderSnapshots): string => {
  switch (snapshot) {
    case ProviderSnapshots.count:
      return "Active Providers";
    case ProviderSnapshots.cpu:
      return "CPU Capacity";
    case ProviderSnapshots.gpu:
      return "GPU Capacity";
    case ProviderSnapshots.memory:
      return "Memory Capacity";
    case ProviderSnapshots.storage:
      return "Disk Storage Capacity";

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

export default ProviderGraphPage;
