import { Box, Theme, Typography, useMediaQuery, useTheme } from "@mui/material";
import { ResponsiveLineCanvas } from "@nivo/line";
import { GraphResponse, ISnapshotMetadata, ProviderSnapshots, Snapshots, SnapshotValue } from "@src/types";
import { SelectedRange } from "@src/utils/constants";
import { nFormatter, roundDecimal } from "@src/utils/mathHelpers";
import { FormattedDate, useIntl } from "react-intl";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  graphContainer: {
    height: "400px",
    position: "relative"
  },
  watermark: {
    position: "absolute",
    top: "4px",
    left: "50%",
    transform: "translateX(-50%)",
    "& span": {
      fontWeight: "bold",
      letterSpacing: "1px",
      fontSize: "1rem",
      color: "rgba(255,255,255,.2)"
    }
  },
  graphTooltip: {
    padding: "5px 10px",
    fontWeight: "bold",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: ".5rem",
    lineHeight: "1rem"
  }
}));

interface IGraphProps {
  rangedData: SnapshotValue[];
  snapshotMetadata: {
    unitFn: (number: any) => ISnapshotMetadata;
    legend?: string;
  };
  snapshotData: GraphResponse;
  snapshot: Snapshots | ProviderSnapshots | "NOT_FOUND";
  selectedRange: SelectedRange;
}

const Graph: React.FunctionComponent<IGraphProps> = ({ rangedData, snapshotMetadata, snapshotData, snapshot, selectedRange }) => {
  const intl = useIntl();
  const muiTheme = useTheme();
  const theme = getTheme(muiTheme);
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const { classes } = useStyles();

  const minValue = rangedData && snapshotMetadata.unitFn(rangedData.map(x => x.value).reduce((a, b) => (a < b ? a : b))).value;
  const maxValue = snapshotData && snapshotMetadata.unitFn(rangedData.map(x => x.value).reduce((a, b) => (a > b ? a : b))).value;
  const graphData = snapshotData
    ? [
        {
          id: snapshot,
          color: "rgb(1,0,0)",
          data: rangedData
            .map(_snapshot => ({
              x: _snapshot.date,
              y: roundDecimal(snapshotMetadata.unitFn(_snapshot.value).value)
            }))
            .sort(function (a, b) {
              return Number(new Date(a.x)) - Number(new Date(b.x));
            })
        }
      ]
    : null;
  const graphMetadata = getGraphMetadataPerRange(selectedRange);

  return (
    <div className={classes.graphContainer}>
      <Box className={classes.watermark}>
        <Typography variant="caption">cloudmos.io</Typography>
      </Box>
      <ResponsiveLineCanvas
        theme={theme}
        data={graphData}
        curve="linear"
        margin={{ top: 30, right: 35, bottom: 50, left: 55 }}
        xScale={{ type: "point" }}
        yScale={{
          type: "linear",
          min: minValue * 0.98,
          max: maxValue * 1.02
        }}
        yFormat=" >-1d"
        // @ts-ignore will be fixed in 0.69.1
        axisBottom={{
          tickRotation: smallScreen ? 45 : 0,
          format: dateStr => intl.formatDate(dateStr, { day: "numeric", month: "short", timeZone: "utc" }),
          tickValues: getTickValues(rangedData, graphMetadata.xModulo)
        }}
        // @ts-ignore will be fixed in 0.69.1
        axisLeft={{
          format: val => nFormatter(val, 2),
          legend: snapshotMetadata.legend,
          legendOffset: -45,
          legendPosition: "middle"
        }}
        axisTop={null}
        axisRight={null}
        colors={muiTheme.palette.secondary.main}
        pointSize={graphMetadata.size}
        pointBorderColor={muiTheme.palette.secondary.main}
        pointColor={"#ffffff"}
        pointBorderWidth={graphMetadata.border}
        isInteractive={true}
        tooltip={props => (
          <div className={classes.graphTooltip}>
            <Typography variant="caption">
              <FormattedDate value={new Date(props.point.data.x)} day="numeric" month="long" timeZone="UTC" year="2-digit" />
            </Typography>
            <Box>{nFormatter(props.point.data.y as number, 2)}</Box>
          </div>
        )}
        enableGridX={false}
        enableCrosshair={true}
      />
    </div>
  );
};

const getTheme = (muiTheme: Theme) => {
  const color = muiTheme.palette.mode === "dark" ? muiTheme.palette.primary.contrastText : muiTheme.palette.primary.main;

  return {
    textColor: color,
    fontSize: 14,
    axis: {
      domain: {
        line: {
          stroke: color,
          strokeWidth: 1
        }
      },
      ticks: {
        line: {
          stroke: color,
          strokeWidth: 1
        }
      }
    },
    grid: {
      line: {
        stroke: color,
        strokeWidth: 0.5
      }
    }
  };
};

const getGraphMetadataPerRange = (range: SelectedRange): { size: number; border: number; xModulo: number } => {
  switch (range) {
    case SelectedRange["7D"]:
      return {
        size: 10,
        border: 3,
        xModulo: 1
      };
    case SelectedRange["1M"]:
      return {
        size: 6,
        border: 2,
        xModulo: 3
      };
    case SelectedRange["ALL"]:
      return {
        size: 0,
        border: 1,
        xModulo: 5
      };

    default:
      return {
        size: 10,
        border: 3,
        xModulo: 1
      };
  }
};

const getTickValues = (rangedData: SnapshotValue[], modulo: number) => {
  const values = rangedData.reverse().filter((data, i) => i % modulo === 0);
  const maxLength = 10;

  if (values.length > maxLength) {
    const mod = Math.round(rangedData.length / maxLength);
    return rangedData.filter((data, i) => i % mod === 0).map(data => data.date);
  } else {
    return values.map(data => data.date);
  }
};

export default Graph;
