"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveLeasesGraph = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var dynamic_1 = require("next/dynamic");
var DiffNumber_1 = require("@src/components/shared/DiffNumber");
var DiffPercentageChip_1 = require("@src/components/shared/DiffPercentageChip");
var TimeRange_1 = require("@src/components/shared/TimeRange");
var graph_config_1 = require("@src/config/graph.config");
var useProvidersQuery_1 = require("@src/queries/useProvidersQuery");
var types_1 = require("@src/types");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var providerUtils_1 = require("@src/utils/providerUtils");
var Title_1 = require("../shared/Title");
var Graph = (0, dynamic_1.default)(function () { return Promise.resolve().then(function () { return require("../graph/Graph"); }); }, {
    ssr: false
});
var ActiveLeasesGraph = function (_a) {
    var provider = _a.provider;
    var _b = (0, useProvidersQuery_1.useProviderActiveLeasesGraph)(provider.owner), snapshotData = _b.data, status = _b.status;
    var _c = (0, react_1.useState)(graph_config_1.SELECTED_RANGE_VALUES["7D"]), selectedRange = _c[0], setSelectedRange = _c[1];
    var hasSnapshotData = snapshotData && snapshotData.snapshots.length > 0;
    var snapshotMetadata = hasSnapshotData && (0, providerUtils_1.getSnapshotMetadata)();
    var rangedData = hasSnapshotData && snapshotData.snapshots.slice(Math.max(snapshotData.snapshots.length - selectedRange, 0), snapshotData.snapshots.length);
    var metric = hasSnapshotData && snapshotMetadata.unitFn(snapshotData.currentValue);
    var metricDiff = hasSnapshotData && snapshotMetadata.unitFn(snapshotData.currentValue - snapshotData.compareValue);
    return (<div className="m-auto max-w-[800px]">
      <div className="mb-1">
        <Title_1.Title subTitle className="space-x-4 font-normal tracking-tight">
          <span>Active Leases</span>
          {provider.name && <span className="text-sm text-muted-foreground">({provider.name})</span>}
        </Title_1.Title>
      </div>

      {!snapshotData && status === "pending" && (<div className="flex items-center justify-center">
          <components_1.Spinner size="large"/>
        </div>)}

      {!hasSnapshotData && status === "success" && <div className="my-2 text-muted-foreground">No data available</div>}

      {hasSnapshotData && (<>
          <div className="mb-4 flex flex-col flex-wrap justify-between sm:flex-row sm:flex-nowrap">
            <div className="mb-4 basis-full sm:mb-0 sm:basis-0">
              <h3 className="flex items-center text-4xl font-bold tracking-tight sm:justify-center">
                <react_intl_1.FormattedNumber value={metric.modifiedValue || metric.value} maximumFractionDigits={2} notation="compact" compactDisplay="short"/>
                &nbsp;{metric.unit ? "".concat(metric.unit, " ") : ""}
                <DiffPercentageChip_1.DiffPercentageChip value={(0, mathHelpers_1.percIncrease)(snapshotData.compareValue, snapshotData.currentValue)} size="medium" className="ml-2"/>
                &nbsp;
                <DiffNumber_1.DiffNumber value={metricDiff.modifiedValue || metricDiff.value} unit={metricDiff.unit} className="whitespace-nowrap text-sm font-light"/>
              </h3>
            </div>

            <TimeRange_1.TimeRange selectedRange={selectedRange} onRangeChange={setSelectedRange}/>
          </div>
          <Graph rangedData={rangedData} snapshotMetadata={snapshotMetadata} snapshot={types_1.ProviderSnapshots.count} snapshotData={snapshotData} selectedRange={selectedRange}/>
        </>)}
    </div>);
};
exports.ActiveLeasesGraph = ActiveLeasesGraph;
