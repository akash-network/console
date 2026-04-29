"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { UTCDateMini } from "@date-fns/utc";
import { format } from "date-fns";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { createChart } from "lightweight-charts";
import { useTheme } from "next-themes";

import { computeInProgressBand } from "@/components/graph/computeInProgressBand";
import { customColors } from "@/lib/colors";
import { nFormatter, roundDecimal } from "@/lib/mathHelpers";
import type { ISnapshotMetadata, SnapshotValue } from "@/types";

interface IGraphProps {
  rangedData: SnapshotValue[];
  completedSnapshots: SnapshotValue[];
  inProgressSnapshot?: SnapshotValue;
  snapshotMetadata: {
    unitFn: (number: any) => ISnapshotMetadata;
    legend?: string;
  };
}

const Graph: React.FunctionComponent<IGraphProps> = ({ rangedData, completedSnapshots, inProgressSnapshot, snapshotMetadata }) => {
  const { resolvedTheme } = useTheme();
  const intl = useIntl();
  const graphTheme = getTheme(resolvedTheme);
  const totalGraphData = useMemo(() => {
    const all = inProgressSnapshot ? [...completedSnapshots, inProgressSnapshot] : completedSnapshots;
    return mapSnapshotsToLineSeriesData(all, snapshotMetadata);
  }, [completedSnapshots, inProgressSnapshot, snapshotMetadata]);

  const inProgressTime = inProgressSnapshot && totalGraphData.length > 0 ? totalGraphData[totalGraphData.length - 1].time : null;
  const previousCompletedTime = inProgressSnapshot && totalGraphData.length > 1 ? totalGraphData[totalGraphData.length - 2].time : null;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [bandStyle, setBandStyle] = useState<{ left: number; width: number; height: number } | null>(null);
  const computeBandRef = useRef<() => void>(() => {});
  const inProgressTimeRef = useRef<string | null>(inProgressTime);
  inProgressTimeRef.current = inProgressTime;

  const computeBand = useCallback(() => {
    const clearIfChanged = () => setBandStyle(prev => (prev === null ? prev : null));
    if (!chartRef.current || !chartContainerRef.current || !inProgressTime || !previousCompletedTime) {
      clearIfChanged();
      return;
    }
    const chart = chartRef.current;
    const timeScale = chart.timeScale();
    const todayX = timeScale.timeToCoordinate(inProgressTime as Time);
    const yesterdayX = timeScale.timeToCoordinate(previousCompletedTime as Time);
    if (todayX == null || yesterdayX == null) {
      clearIfChanged();
      return;
    }
    const rightAxisWidth = chart.priceScale("right").width();
    const plotAreaWidth = Math.max(chartContainerRef.current.clientWidth - rightAxisWidth, 0);
    const { left, width } = computeInProgressBand({ todayX, previousX: yesterdayX, plotAreaWidth });
    const height = Math.max(400 - timeScale.height(), 0);
    setBandStyle(prev => (prev && prev.left === left && prev.width === width && prev.height === height ? prev : { left, width, height }));
  }, [inProgressTime, previousCompletedTime]);

  computeBandRef.current = computeBand;

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
        const isInProgressPoint = inProgressTimeRef.current != null && param.time.toString() === inProgressTimeRef.current;
        toolTip.innerHTML = `<div style='margin-bottom: 0.25rem; font-size: 0.75rem; line-height: 1rem'>
            ${format(new UTCDateMini(param.time.toString()), "MMMM d, yy")}${isInProgressPoint ? " (in progress)" : ""}
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

    let pendingRafId: number | null = null;
    const scheduleBandRecompute = () => {
      if (pendingRafId !== null) return;
      pendingRafId = requestAnimationFrame(() => {
        pendingRafId = null;
        computeBandRef.current();
      });
    };

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        chart.resize(chartContainerRef.current.clientWidth, 400);
        scheduleBandRecompute();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    const handleVisibleRangeChange = () => scheduleBandRecompute();
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    return () => {
      if (pendingRafId !== null) cancelAnimationFrame(pendingRafId);
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      chartRef.current = null;
      lineSeriesRef.current = null;
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme, intl.locale]);

  useEffect(() => {
    if (!lineSeriesRef.current || !chartRef.current) return;

    lineSeriesRef.current.setData(totalGraphData);

    if (rangedData.length > 0 && rangedData.length < totalGraphData.length) {
      const startIdx = totalGraphData.length - rangedData.length;
      const from = totalGraphData[startIdx].time;
      const to = totalGraphData[totalGraphData.length - 1].time;
      chartRef.current.timeScale().setVisibleRange({ from, to });
    } else {
      chartRef.current.timeScale().fitContent();
    }

    computeBandRef.current();
    const rafId = requestAnimationFrame(() => computeBandRef.current());
    return () => cancelAnimationFrame(rafId);
  }, [totalGraphData, rangedData, resolvedTheme, intl.locale]);

  return (
    <div className="relative h-[400px]">
      <div className="absolute left-1/2 top-1 -translate-x-1/2">
        <span className="text-md font-bold tracking-wide text-muted-foreground opacity-40">stats.akash.network</span>
      </div>
      <div ref={chartContainerRef} className="relative">
        {bandStyle && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 z-20 border-l border-dashed border-muted-foreground/30 bg-muted-foreground/10"
              style={{
                left: `${bandStyle.left}px`,
                width: `${bandStyle.width}px`,
                height: `${bandStyle.height}px`
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute z-20 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ left: `${bandStyle.left + 4}px`, top: 4 }}
            >
              In progress
            </div>
          </>
        )}
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
