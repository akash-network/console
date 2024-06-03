"use client";
import { FormattedDate, useIntl } from "react-intl";
import { useTheme as useMuiTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ResponsiveLineCanvas } from "@nivo/line";
import { useTheme } from "next-themes";

import { GraphResponse, ISnapshotMetadata, ProviderSnapshots, Snapshots, SnapshotValue } from "@src/types";
import { customColors } from "@src/utils/colors";
import { selectedRangeValues } from "@src/utils/constants";
import { nFormatter, roundDecimal } from "@src/utils/mathHelpers";

interface IGraphProps {
  rangedData: SnapshotValue[];
  snapshotMetadata: {
    unitFn: (number: any) => ISnapshotMetadata;
    legend?: string;
  };
  snapshotData: GraphResponse;
  snapshot: Snapshots | ProviderSnapshots | "NOT_FOUND";
  selectedRange: number;
}

const Graph: React.FunctionComponent<IGraphProps> = ({ rangedData, snapshotMetadata, snapshotData, snapshot, selectedRange }) => {
  const { resolvedTheme } = useTheme();
  const intl = useIntl();
  const graphTheme = getTheme(resolvedTheme);
  const muiTheme = useMuiTheme();
  const smallScreen = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const minValue = rangedData && snapshotMetadata.unitFn(rangedData.map(x => x.value).reduce((a: number, b: number) => (a < b ? a : b))).value;
  const maxValue = snapshotData && snapshotMetadata.unitFn(rangedData.map(x => x.value).reduce((a: number, b: number) => (a > b ? a : b))).value;
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
    : [];
  const graphMetadata = getGraphMetadataPerRange(selectedRange);

  return (
    <div className="relative h-[400px]">
      <ResponsiveLineCanvas
        theme={graphTheme}
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
        colors={customColors.akashRed}
        pointSize={graphMetadata.size}
        pointBorderColor={customColors.akashRed}
        pointColor={"#ffffff"}
        pointBorderWidth={graphMetadata.border}
        isInteractive={true}
        tooltip={props => (
          <div className="bg-primary text-primary-foreground rounded-sm px-3 py-2 leading-4">
            <div className="mb-1 text-xs">
              <FormattedDate value={new Date(props.point.data.x)} day="numeric" month="long" timeZone="UTC" year="2-digit" />
            </div>
            <div className="font-bold">{nFormatter(props.point.data.y as number, 2)}</div>
          </div>
        )}
        enableGridX={false}
        enableCrosshair={true}
      />
    </div>
  );
};

const getTheme = (theme: string | undefined) => {
  // TODO Use the same colors as the theme
  const color = theme === "dark" ? customColors.white : customColors.black;

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
        },
        text: {
          fill: color
        }
      },
      legend: {
        text: {
          fill: color
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

const getGraphMetadataPerRange = (range: number): { size: number; border: number; xModulo: number } => {
  switch (range) {
    case selectedRangeValues["7D"]:
      return {
        size: 10,
        border: 3,
        xModulo: 1
      };
    case selectedRangeValues["1M"]:
      return {
        size: 6,
        border: 2,
        xModulo: 3
      };
    case selectedRangeValues["ALL"]:
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
