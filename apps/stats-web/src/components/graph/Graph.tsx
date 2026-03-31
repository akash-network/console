"use client";
import React, { useEffect, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { UTCDateMini } from "@date-fns/utc";
import { format } from "date-fns";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { createChart } from "lightweight-charts";
import { useTheme } from "next-themes";

import { customColors } from "@/lib/colors";
import { nFormatter, roundDecimal } from "@/lib/mathHelpers";
import type { GraphResponse, ISnapshotMetadata, SnapshotValue } from "@/types";

interface IGraphProps {
  rangedData: SnapshotValue[];
  snapshotMetadata: {
    unitFn: (number: any) => ISnapshotMetadata;
    legend?: string;
  };
  snapshotData: GraphResponse;
}

const Graph: React.FunctionComponent<IGraphProps> = ({ rangedData, snapshotMetadata, snapshotData }) => {
  const { resolvedTheme } = useTheme();
  const intl = useIntl();
  const graphTheme = getTheme(resolvedTheme);
  const initialData = useMemo(() => mapSnapshotsToLineSeriesData(rangedData, snapshotMetadata), [rangedData, snapshotMetadata]);
  const totalGraphData = useMemo(() => mapSnapshotsToLineSeriesData(snapshotData?.snapshots, snapshotMetadata), [snapshotData?.snapshots, snapshotMetadata]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const timer = useRef<number | null>(null);
  const graphDataRef = useRef<ReturnType<typeof mapSnapshotsToLineSeriesData>>([]);
  const totalGraphDataRef = useRef(totalGraphData);
  totalGraphDataRef.current = totalGraphData;

  // Create/recreate chart on mount and theme change
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const axisRightFormatter = (val: number) => nFormatter(val, 2);
    const axisBottomFormatter = (dateStr: string) => intl.formatDate(dateStr, { day: "numeric", month: "short", timeZone: "utc" });

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      layout: {
        textColor: graphTheme.textColor,
        background: { color: "transparent" },
        attributionLogo: false
      },
      height: 400
    });

    const lineSeries = chart.addLineSeries({ color: customColors.akashRed, lineWidth: 2 });

    chartRef.current = chart;
    lineSeriesRef.current = lineSeries;

    chart.applyOptions({
      localization: {
        priceFormatter: axisRightFormatter,
        timeFormatter: axisBottomFormatter
      },
      rightPriceScale: {
        scaleMargins: {
          top: 0.05,
          bottom: 0.05
        },
        borderColor: graphTheme.axis.domain.line.stroke
      },
      timeScale: {
        borderColor: graphTheme.axis.domain.line.stroke
      },
      crosshair: {
        horzLine: {
          visible: false,
          labelVisible: false
        },
        vertLine: {
          labelVisible: false
        }
      },
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
    if (toolTip) {
      toolTip.style.display = "none";
    }

    chart.subscribeCrosshairMove(param => {
      if (!toolTip || !chartContainerRef.current) return;

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
            ${format(new UTCDateMini(param.time.toString()), "MMMM d, yy")}
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
      if (logicalRange === null) return;
      if (timer.current !== null) return;
      if (logicalRange.from >= 0) return;

      timer.current = window.setTimeout(() => {
        const currentTotalData = totalGraphDataRef.current;
        const currentGraphData = graphDataRef.current;

        if (currentGraphData.length === 0) {
          timer.current = null;
          return;
        }

        const currentStart = Math.max(currentTotalData.length - currentGraphData.length, 0);
        const prependCount = Math.min(Math.ceil(-logicalRange.from), currentStart);

        if (prependCount > 0) {
          const nextStart = currentStart - prependCount;
          const newGraphData = [...currentTotalData.slice(nextStart, currentStart), ...currentGraphData];
          graphDataRef.current = newGraphData;

          if (lineSeriesRef.current) {
            lineSeriesRef.current.setData(newGraphData);
          }
        }
        timer.current = null;
      }, 500);
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        chart.resize(chartContainerRef.current.clientWidth, 400);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      chartRef.current = null;
      lineSeriesRef.current = null;
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  // Update data when range changes
  useEffect(() => {
    if (!lineSeriesRef.current || !chartRef.current) return;

    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    graphDataRef.current = [...initialData];
    lineSeriesRef.current.setData(initialData);
    chartRef.current.timeScale().fitContent();
  }, [initialData, resolvedTheme]);

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

function mapSnapshotsToLineSeriesData(snapshots: SnapshotValue[] | undefined | null, snapshotMetadata: IGraphProps["snapshotMetadata"]) {
  if (!snapshots) return [];

  return snapshots
    .map(_snapshot => {
      const datetime = new UTCDateMini(_snapshot.date);
      return {
        datetime,
        time: format(datetime, "yyyy-MM-dd"),
        value: roundDecimal(snapshotMetadata.unitFn(_snapshot.value).value)
      };
    })
    .sort((row, anotherRow) => {
      return row.datetime.getTime() - anotherRow.datetime.getTime();
    });
}

const getTheme = (theme: string | undefined) => {
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
