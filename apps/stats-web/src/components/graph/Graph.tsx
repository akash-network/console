"use client";
import React, { useRef, useEffect, useMemo } from "react";

import { createChart } from "lightweight-charts";
import { format } from "date-fns";
import { useIntl } from "react-intl";
import { useTheme } from "next-themes";

import { customColors } from "@/lib/colors";
import { nFormatter, roundDecimal } from "@/lib/mathHelpers";
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

  const initialData = useMemo(
    () =>
      snapshotData
        ? rangedData
            .map(_snapshot => ({
              time: format(_snapshot.date, "yyyy-MM-dd"),
              value: roundDecimal(snapshotMetadata.unitFn(_snapshot.value).value)
            }))
            .sort(function (a, b) {
              return Number(new Date(a.time)) - Number(new Date(b.time));
            })
        : [],
    [rangedData]
  );

  const totalGraphData = useMemo(
    () =>
      snapshotData
        ? snapshotData.snapshots
            .map(_snapshot => ({
              time: format(_snapshot.date, "yyyy-MM-dd"),
              value: roundDecimal(snapshotMetadata.unitFn(_snapshot.value).value)
            }))
            .sort(function (a, b) {
              return Number(new Date(a.time)) - Number(new Date(b.time));
            })
        : [],
    [rangedData]
  );

  const chartContainerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let graphData = [...initialData];
    let isDisposed = false;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      layout: {
        textColor: graphTheme.textColor,
        background: { color: "transparent" },
        attributionLogo: false
      },
      height: 400
    });

    chart.timeScale().fitContent();

    const lineSeries = chart.addLineSeries({ color: customColors.akashRed, lineWidth: 2 });
    lineSeries.setData(graphData);

    const axisRightFormatter = val => nFormatter(val, 2);
    const axisBottomFormatter = dateStr => intl.formatDate(dateStr, { day: "numeric", month: "short", timeZone: "utc" });

    chart.applyOptions({
      localization: {
        priceFormatter: axisRightFormatter,
        timeFormatter: axisBottomFormatter
      },
      rightPriceScale: {
        scaleMargins: {
          top: 0.05,
          bottom: 0.05
        }
      },
      crosshair: {
        // hide the horizontal crosshair line
        horzLine: {
          visible: false,
          labelVisible: false
        },
        // hide the vertical crosshair label
        vertLine: {
          labelVisible: false
        }
      },
      // hide the grid lines
      grid: {
        vertLines: {
          visible: false
        },
        horzLines: {
          visible: false
        }
      }
    });

    const toolTipWidth = 80;
    const toolTipHeight = 80;
    const toolTipMargin = 15;

    const toolTip = tooltipRef.current;
    toolTip.style.display = "none";

    chart.subscribeCrosshairMove(param => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current.clientHeight
      ) {
        toolTip.style.display = "none";
      } else {
        const data: any = param.seriesData.get(lineSeries);
        toolTip.innerHTML = `<div style='margin-bottom: 0.25rem; font-size: 0.75rem; line-height: 1rem'>
            ${format(new Date(param.time.toString()), "MMMM d, yy")}
            </div>
            <div style="font-weight: 700">${nFormatter(data?.value, 2)}</div>
        `;

        const y = param.point.y;
        let left = param.point.x + toolTipMargin;
        if (left > chartContainerRef.current.clientWidth - toolTipWidth) {
          left = param.point.x - toolTipMargin - toolTipWidth;
        }

        let top = y + toolTipMargin;
        if (top > chartContainerRef.current.clientHeight - toolTipHeight) {
          top = y - toolTipHeight - toolTipMargin;
        }

        toolTip.style.left = `${left}px`;
        toolTip.style.top = `${top}px`;
        toolTip.style.display = "block";
      }
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(logicalRange => {
      if (logicalRange === null) {
        return;
      }

      if (timer.current !== null) {
        return;
      }

      timer.current = window.setTimeout(() => {
        const rangeFrom = Math.round(logicalRange.from);
        const range = Math.max(graphData.length - rangeFrom, 0);
        graphData = [...totalGraphData.slice(range, -graphData.length), ...graphData];
        if (!isDisposed && lineSeries) {
          lineSeries.setData(graphData);
        }
        timer.current = null;
      }, 500);
    });

    // Handle resize
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      chart.resize(chartContainerRef.current.clientWidth, 400);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      isDisposed = true;
      chart.remove();
    };
  }, [initialData]);

  return (
    <div className="relative h-[400px]">
      <div className="absolute left-1/2 top-1 -translate-x-1/2">
        <span className="text-md font-bold tracking-wide text-muted-foreground opacity-40">stats.akash.network</span>
      </div>
      <div ref={chartContainerRef} className="relative">
        <div ref={tooltipRef} className="absolute z-50 hidden rounded-sm bg-primary px-3 py-2 leading-4 text-primary-foreground"></div>
        {snapshotMetadata.legend && <div className="absolute right-0 top-1/2 z-50 translate-y-[-50%] text-xs">{snapshotMetadata.legend}</div>}
      </div>
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

export default Graph;
