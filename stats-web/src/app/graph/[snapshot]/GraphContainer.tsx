"use client";
import React, { useState } from "react";
import { FormattedNumber } from "react-intl";
import dynamic from "next/dynamic";
// import { parseAsync } from "json2csv";
import { Parser } from "@json2csv/plainjs";
import { ISnapshotMetadata, Snapshots } from "@/types";
import { selectedRangeValues } from "@/lib/constants";
import { useGraphSnapshot } from "@/queries";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { DiffPercentageChip } from "@/components/DiffPercentageChip";
import { DiffNumber } from "@/components/DiffNumber";
import { percIncrease, udenomToDenom } from "@/lib/mathHelpers";
import { TimeRange } from "@/components/graph/TimeRange";
import { bytesToShrink } from "@/lib/unitUtils";

const Graph = dynamic(() => import("../../../components/graph/Graph"), {
  ssr: false
});

export interface IGraphProps {
  snapshot: Snapshots;
}

export default function GraphContainer({ snapshot }: IGraphProps) {
  const [selectedRange, setSelectedRange] = useState(selectedRangeValues["7D"]);
  const { data: snapshotData, status } = useGraphSnapshot(snapshot);
  const snapshotMetadata = snapshotData && getSnapshotMetadata(snapshot as Snapshots);
  const rangedData = snapshotData && snapshotData.snapshots.slice(Math.max(snapshotData.snapshots.length - selectedRange, 0), snapshotData.snapshots.length);
  const metric = snapshotMetadata && snapshotMetadata.unitFn(snapshotData.currentValue);
  const metricDiff = snapshotMetadata && snapshotMetadata.unitFn(snapshotData.currentValue - snapshotData.compareValue);

  async function onDownloadCSVClick() {
    if (!rangedData || !snapshotMetadata) return;

    const parser = new Parser({
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
    });
    const csvContent = parser.parse(rangedData.map(d => ({ date: d.date, value: snapshotMetadata.unitFn(d.value).value })));

    const datePart = new Date().toISOString().substring(0, 10).replaceAll("-", "");
    const rangePart = Object.keys(selectedRangeValues).find(key => selectedRangeValues[key] === selectedRange);
    const fileName = `${snapshot}-${datePart}-${rangePart}.csv`;

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link); // Required for FF

    link.click();
  }

  return (
    <>
      {!snapshotData && status === "loading" && (
        <div className="mb-4 mt-16 flex items-center justify-center">
          <Spinner size="large" />
        </div>
      )}

      {snapshotData && snapshotMetadata && rangedData && metricDiff && metric && (
        <>
          <div className="mb-4 flex flex-col flex-wrap items-center justify-between sm:flex-row sm:flex-nowrap">
            <div className="mb-4 basis-full sm:mb-0 sm:basis-0">
              <h3 className="flex items-center text-4xl font-bold sm:justify-center">
                <FormattedNumber value={metric.modifiedValue || metric.value} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
                &nbsp;{metric.unit ? `${metric.unit} ` : ""}
                <DiffPercentageChip value={percIncrease(snapshotData.compareValue, snapshotData.currentValue)} size="medium" className="ml-2" />
                &nbsp;
                <DiffNumber value={metricDiff.modifiedValue || metricDiff.value} unit={metricDiff.unit} className="text-sm font-light whitespace-nowrap" />
              </h3>
            </div>

            <TimeRange selectedRange={selectedRange} onRangeChange={setSelectedRange} />
          </div>

          <Graph rangedData={rangedData} snapshotMetadata={snapshotMetadata} snapshot={snapshot} snapshotData={snapshotData} selectedRange={selectedRange} />
          {snapshotData && (
            <div className="mt-8 text-right">
              <Button variant="outline" color="secondary" onClick={onDownloadCSVClick}>
                <Download />
                &nbsp;Download .CSV
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

const getSnapshotMetadata = (snapshot: Snapshots): { unitFn: (number: number) => ISnapshotMetadata; legend?: string } => {
  switch (snapshot) {
    case Snapshots.dailyUAktSpent:
    case Snapshots.totalUAktSpent:
    case Snapshots.dailyUUsdcSpent:
    case Snapshots.totalUUsdcSpent:
    case Snapshots.dailyUUsdSpent:
    case Snapshots.totalUUsdSpent:
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
