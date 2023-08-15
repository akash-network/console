import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { Theme } from "@mui/material";
import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import { ResponsiveLine, PointMouseHandler, Datum } from "@nivo/line";
import { customColors } from "@src/utils/colors";
import { nFormatter } from "@src/utils/mathHelpers";
import { FormattedDate, useIntl } from "react-intl";
import { Theme as NivoTheme } from "@nivo/core";

type Props = {
  onMouseEnter?: PointMouseHandler;
  onMouseLeave?: PointMouseHandler;
  onMouseMove?: PointMouseHandler;
  data?: Datum[];
  showDecimals?: boolean;
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  root: {
    height: "100%"
  },
  graphTooltip: {
    padding: "5px 10px",
    fontWeight: "bold",
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.primary.main : theme.palette.grey[500],
    color: theme.palette.primary.contrastText,
    borderRadius: ".5rem",
    lineHeight: "1rem"
  }
}));

const LineChart: React.FunctionComponent<Props> = ({ children, showDecimals, data, onMouseEnter, onMouseLeave, onMouseMove }) => {
  const { classes } = useStyles();
  const intl = useIntl();
  const theme = useTheme();
  const chartTheme = getTheme(theme);

  const usedData = data || demoData;

  return (
    <div className={classes.root}>
      <ResponsiveLine
        data={[
          {
            id: "line-chart",
            data: usedData
          }
        ]}
        margin={{ top: 10, right: 20, bottom: 30, left: 30 }}
        yScale={{
          type: "linear",
          min: "auto",
          max: "auto",
          reverse: false,
          stacked: false
        }}
        yFormat=" >-.2f"
        axisTop={null}
        axisRight={null}
        xScale={{ type: "time", format: "%Y-%m-%dT%H:%M:%S.%L%Z", useUTC: true, precision: "day" }}
        axisBottom={{
          // orient: 'bottom',
          tickValues: usedData.length <= 7 ? "every 1 day" : undefined,
          tickSize: 0,
          tickPadding: 10,
          tickRotation: 0,
          legendOffset: 36,
          format: dateStr => intl.formatDate(dateStr, { day: "numeric", month: "short", timeZone: "utc" })
        }}
        axisLeft={{
          // orient: 'left',
          tickSize: 0,
          tickPadding: 10,
          tickRotation: 0,
          legendOffset: -40,
          format: val => (showDecimals ? val : Math.floor(val) === val && nFormatter(val, 2))
        }}
        enableGridX={false}
        enableGridY={false}
        lineWidth={3}
        enablePoints={false}
        useMesh={true}
        colors={[customColors.main]}
        legends={[]}
        theme={chartTheme}
        tooltip={props => (
          <div className={classes.graphTooltip}>
            <Typography variant="caption">
              <FormattedDate value={new Date(props.point.data.x)} day="numeric" month="long" timeZone="UTC" />
            </Typography>
            <div>{showDecimals ? props.point.data.y : nFormatter(props.point.data.y as number, 2)}</div>
          </div>
        )}
      />
    </div>
  );
};

const getTheme = (theme: Theme): NivoTheme => {
  return {
    textColor: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main,
    fontSize: 12,
    axis: {
      domain: {
        line: {
          stroke: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main,
          strokeWidth: 1
        }
      },
      ticks: {
        line: {
          stroke: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main,
          strokeWidth: 1
        }
      }
    },
    grid: {
      line: {
        stroke: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main,
        strokeWidth: 0.5
      }
    },
    crosshair: {
      line: {
        stroke: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main
      }
    }
  };
};

// mock data
const demoData = [
  {
    x: "2021-03-08T00:00:00.000Z",
    y: 40
  },
  {
    x: "2021-03-09T00:00:00.000Z",
    y: 55
  },
  {
    x: "2021-03-10T00:00:00.000Z",
    y: 45
  },
  {
    x: "2021-03-11T00:00:00.000Z",
    y: 60
  },
  {
    x: "2021-03-12T00:00:00.000Z",
    y: 65
  },
  {
    x: "2021-03-13T00:00:00.000Z",
    y: 85
  },
  {
    x: "2021-03-14T00:00:00.000Z",
    y: 95
  }
];

export default LineChart;
