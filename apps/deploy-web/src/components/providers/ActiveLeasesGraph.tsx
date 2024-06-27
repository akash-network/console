"use client";
import React, { useState } from "react";
import { FormattedNumber } from "react-intl";
import { Spinner } from "@akashnetwork/ui/components";
import dynamic from "next/dynamic";

import { DiffNumber } from "@src/components/shared/DiffNumber";
import { DiffPercentageChip } from "@src/components/shared/DiffPercentageChip";
import { TimeRange } from "@src/components/shared/TimeRange";
import { useProviderActiveLeasesGraph } from "@src/queries/useProvidersQuery";
import { ProviderSnapshots } from "@src/types";
import { ClientProviderDetailWithStatus } from "@src/types/provider";
import { selectedRangeValues } from "@src/utils/constants";
import { percIncrease } from "@src/utils/mathHelpers";
import { getSnapshotMetadata } from "@src/utils/providerUtils";
import { Title } from "../shared/Title";

const Graph = dynamic(() => import("../graph/Graph"), {
  ssr: false
});

interface IProps {
  provider: ClientProviderDetailWithStatus;
}

export const ActiveLeasesGraph: React.FunctionComponent<IProps> = ({ provider }) => {
  const { data: snapshotData, status } = useProviderActiveLeasesGraph(provider.owner);
  const [selectedRange, setSelectedRange] = useState(selectedRangeValues["7D"]);
  const hasSnapshotData = snapshotData && snapshotData.snapshots.length > 0;
  const snapshotMetadata = hasSnapshotData && getSnapshotMetadata();
  const rangedData = hasSnapshotData && snapshotData.snapshots.slice(Math.max(snapshotData.snapshots.length - selectedRange, 0), snapshotData.snapshots.length);
  const metric = hasSnapshotData && snapshotMetadata.unitFn(snapshotData.currentValue);
  const metricDiff = hasSnapshotData && snapshotMetadata.unitFn(snapshotData.currentValue - snapshotData.compareValue);

  return (
    <div className="m-auto max-w-[800px]">
      <div className="mb-1">
        <Title subTitle className="space-x-4 font-normal tracking-tight">
          <span>Active Leases</span>
          {provider.name && <span className="text-sm text-muted-foreground">({provider.name})</span>}
        </Title>
      </div>

      {!snapshotData && status === "loading" && (
        <div className="flex items-center justify-center">
          <Spinner size="large" />
        </div>
      )}

      {!hasSnapshotData && status === "success" && <div className="my-2 text-muted-foreground">No data available</div>}

      {hasSnapshotData && (
        <>
          <div className="mb-4 flex flex-col flex-wrap justify-between sm:flex-row sm:flex-nowrap">
            <div className="mb-4 basis-full sm:mb-0 sm:basis-0">
              <h3 className="flex items-center text-4xl font-bold tracking-tight sm:justify-center">
                <FormattedNumber value={metric.modifiedValue || metric.value} maximumFractionDigits={2} notation="compact" compactDisplay="short" />
                &nbsp;{metric.unit ? `${metric.unit} ` : ""}
                <DiffPercentageChip value={percIncrease(snapshotData.compareValue, snapshotData.currentValue)} size="medium" className="ml-2" />
                &nbsp;
                <DiffNumber value={metricDiff.modifiedValue || metricDiff.value} unit={metricDiff.unit} className="whitespace-nowrap text-sm font-light" />
              </h3>
            </div>

            <TimeRange selectedRange={selectedRange} onRangeChange={setSelectedRange} />
          </div>
          <Graph
            rangedData={rangedData}
            snapshotMetadata={snapshotMetadata}
            snapshot={ProviderSnapshots.count}
            snapshotData={snapshotData}
            selectedRange={selectedRange}
          />
        </>
      )}
    </div>
  );
};
