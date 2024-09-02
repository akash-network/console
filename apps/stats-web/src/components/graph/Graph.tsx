"use client";
import React, { useRef, useEffect } from 'react';


import { createChart } from 'lightweight-charts';
import moment from "moment";
import { FormattedDate, useIntl } from "react-intl";
import { ResponsiveLineCanvas } from "@nivo/line";
import { useTheme } from "next-themes";
import { useMediaQuery } from "usehooks-ts";

import { customColors } from "@/lib/colors";
import { selectedRangeValues } from "@/lib/constants";
import { nFormatter, roundDecimal } from "@/lib/mathHelpers";
import { breakpoints } from "@/lib/responsiveUtils";
import { GraphResponse, ISnapshotMetadata, ProviderSnapshots, Snapshots, SnapshotValue } from "@/types";

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
  const smallScreen = useMediaQuery(breakpoints.xs.mediaQuery);
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
    : [];
  const graphMetadata = getGraphMetadataPerRange(selectedRange);

  const newGraphData = snapshotData
    ? rangedData.map(_snapshot => (
      {
        time: moment.utc(_snapshot.date).format('YYYY-MM-DD'),
        value: _snapshot.value
      })).sort(function (a, b) {
        return Number(new Date(a.time)) - Number(new Date(b.time));
      }) : [];


  const chartContainerRef = useRef(null);
  const tooltipRef = useRef(null);


  useEffect(() => {
    if (chartContainerRef.current) {

    }
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      layout: {
        textColor: graphTheme.textColor,
        background: { color: "transparent" },
      },
      height: 300,
    });

    chart.timeScale().fitContent();

    const lineSeries = chart.addLineSeries({ color: customColors.akashRed, });
    lineSeries.setData(newGraphData);

    const axisRightFormatter =  val => nFormatter(val, 2);
    const axisBottomFormatter = dateStr => intl.formatDate(dateStr, { day: "numeric", month: "short", timeZone: "utc" });

    chart.applyOptions({
      localization: {
        priceFormatter: axisRightFormatter,
        timeFormatter: axisBottomFormatter,
      },
      rightPriceScale: {
        // autoScale: false,
        scaleMargins: {
          top: 0.3, // leave some space for the legend
          bottom: 0.25,
        },
      },
      crosshair: {
        // hide the horizontal crosshair line
        horzLine: {
          visible: false,
          labelVisible: false,
        },
        // hide the vertical crosshair label
        vertLine: {
          labelVisible: false,
        },
      },
      // hide the grid lines
      grid: {
        vertLines: {
          visible: false,
        },
        horzLines: {
          visible: false,
        },
      },
    });

    const toolTipWidth = 80;
    const toolTipHeight = 80;
    const toolTipMargin = 15;

    const toolTip = tooltipRef.current;
    toolTip.style.display = 'none';

    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current.clientHeight
      ) {
        toolTip.style.display = 'none';
      } else {
        const data:any = param.seriesData.get(lineSeries);
        toolTip.innerHTML = `<div style='margin-bottom: 0.25rem; font-size: 0.75rem; line-height: 1rem'>
            ${moment.utc(param.time).format("MMMM DD, yy")}
            </div>
            <div style="font-weight: 700">${nFormatter(data?.value, 2)}</div>
        `

        const y = param.point.y;
        let left = param.point.x + toolTipMargin;
        if (left > chartContainerRef.current.clientWidth - toolTipWidth) {
          left = param.point.x - toolTipMargin - toolTipWidth;
        }

        let top = y + toolTipMargin;
        if (top > chartContainerRef.current.clientHeight - toolTipHeight) {
          top = y - toolTipHeight - toolTipMargin;
        }

        toolTip.style.left = left + 'px';
        toolTip.style.top = top + 'px';
        toolTip.style.display = 'block';
      }
    });

    // Handle resize
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [newGraphData]);


  return (
    <div className="relative h-[400px]">
      <div className="absolute left-1/2 top-1 -translate-x-1/2">
        <span className="text-md font-bold tracking-wide text-muted-foreground opacity-40">stats.akash.network</span>
      </div>
      <div ref={chartContainerRef} className="relative">
        <div ref={tooltipRef} className="absolute hidden rounded-sm bg-primary px-3 py-2 leading-4 text-primary-foreground z-50"></div>
      </div>

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
        axisBottom={{
          tickRotation: smallScreen ? 45 : 0,
          format: dateStr => intl.formatDate(dateStr, { day: "numeric", month: "short", timeZone: "utc" }),
          tickValues: getTickValues(rangedData, graphMetadata.xModulo)
        }}
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
          <div className="rounded-sm bg-primary px-3 py-2 leading-4 text-primary-foreground">
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
