"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
var react_intl_1 = require("react-intl");
var pie_1 = require("@nivo/pie");
var tooltip_1 = require("@nivo/tooltip");
var next_themes_1 = require("next-themes");
var useTailwind_1 = require("@src/hooks/useTailwind");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var unitUtils_1 = require("@src/utils/unitUtils");
var getPieChartEntryColor = function (datum) { return datum.data.color; };
var NetworkCapacity = function (props) {
    var activeCPU = props.activeCPU, pendingCPU = props.pendingCPU, totalCPU = props.totalCPU, activeGPU = props.activeGPU, pendingGPU = props.pendingGPU, totalGPU = props.totalGPU, activeMemory = props.activeMemory, pendingMemory = props.pendingMemory, totalMemory = props.totalMemory, activeStorage = props.activeStorage, pendingStorage = props.pendingStorage, totalStorage = props.totalStorage;
    var activeMemoryBytes = activeMemory + pendingMemory;
    var availableMemoryBytes = totalMemory - (activeMemory + pendingMemory);
    var activeStorageBytes = activeStorage + pendingStorage;
    var _activeMemory = (0, unitUtils_1.bytesToShrink)(activeMemoryBytes);
    var _totalMemory = (0, unitUtils_1.bytesToShrink)(totalMemory);
    var _availableMemory = (0, unitUtils_1.bytesToShrink)(availableMemoryBytes);
    var _activeStorage = (0, unitUtils_1.bytesToShrink)(activeStorageBytes);
    var _totalStorage = (0, unitUtils_1.bytesToShrink)(totalStorage);
    var cpuData = useData(activeCPU + pendingCPU, totalCPU - activeCPU - pendingCPU);
    var gpuData = useData(activeGPU + pendingGPU, totalGPU - activeGPU - pendingGPU);
    var memoryData = useData(activeMemoryBytes, availableMemoryBytes);
    var storageData = useStorageData(props);
    var pieTheme = usePieTheme();
    var intl = (0, react_intl_1.useIntl)();
    return (<div className="flex flex-col items-start md:flex-row md:items-center">
      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">CPU</p>
        <p className="text-sm text-muted-foreground">
          {Math.round(activeCPU + pendingCPU)}&nbsp;CPU&nbsp;/&nbsp;{Math.round(totalCPU)}&nbsp;CPU
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <pie_1.ResponsivePie data={cpuData} margin={{ top: 15, right: 15, bottom: 15, left: 0 }} innerRadius={0.3} padAngle={2} cornerRadius={4} activeOuterRadiusOffset={8} colors={getPieChartEntryColor} borderWidth={0} borderColor={{
            from: "color",
            modifiers: [["darker", 0.2]]
        }} valueFormat={function (value) {
            return "".concat(intl.formatNumber((0, mathHelpers_1.roundDecimal)(value, 2), {
                notation: "compact",
                compactDisplay: "short",
                maximumFractionDigits: 2
            }), " CPU");
        }} enableArcLinkLabels={false} arcLabelsSkipAngle={30} theme={pieTheme} tooltip={TooltipLabel}/>
        </div>
      </div>

      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">GPU</p>
        <p className="text-sm text-muted-foreground">
          {Math.round(activeGPU + pendingGPU)}&nbsp;GPU&nbsp;/&nbsp;{Math.round(totalGPU)}&nbsp;GPU
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <pie_1.ResponsivePie data={gpuData} margin={{ top: 15, right: 15, bottom: 15, left: 0 }} innerRadius={0.3} padAngle={2} cornerRadius={4} activeOuterRadiusOffset={8} colors={getPieChartEntryColor} borderWidth={0} borderColor={{
            from: "color",
            modifiers: [["darker", 0.2]]
        }} valueFormat={function (value) {
            return "".concat(intl.formatNumber((0, mathHelpers_1.roundDecimal)(value, 2), {
                notation: "compact",
                compactDisplay: "short"
            }), " GPU");
        }} enableArcLinkLabels={false} arcLabelsSkipAngle={30} theme={pieTheme} tooltip={TooltipLabel}/>
        </div>
      </div>

      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">Memory</p>
        <p className="text-sm text-muted-foreground">
          {"".concat((0, mathHelpers_1.roundDecimal)(_activeMemory.value, 2), " ").concat(_activeMemory.unit)}&nbsp;/&nbsp;{"".concat((0, mathHelpers_1.roundDecimal)(_totalMemory.value, 2), " ").concat(_totalMemory.unit)}
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <pie_1.ResponsivePie data={memoryData} margin={{ top: 15, right: 15, bottom: 15, left: 15 }} innerRadius={0.3} padAngle={2} cornerRadius={4} activeOuterRadiusOffset={8} colors={getPieChartEntryColor} borderWidth={0} borderColor={{
            from: "color",
            modifiers: [["darker", 0.2]]
        }} valueFormat={function (value) {
            return value === activeMemoryBytes
                ? "".concat((0, mathHelpers_1.roundDecimal)(_activeMemory.value, 2), " ").concat(_activeMemory.unit)
                : "".concat((0, mathHelpers_1.roundDecimal)(_availableMemory.value, 2), " ").concat(_availableMemory.unit);
        }} enableArcLinkLabels={false} arcLabelsSkipAngle={30} theme={pieTheme} tooltip={TooltipLabel}/>
        </div>
      </div>

      <div className="basis-1/4">
        <p className="font-bold leading-4 tracking-tight">Storage</p>
        <p className="text-sm text-muted-foreground">
          {"".concat((0, mathHelpers_1.roundDecimal)(_activeStorage.value, 2), " ").concat(_activeStorage.unit)}&nbsp;/&nbsp;{"".concat((0, mathHelpers_1.roundDecimal)(_totalStorage.value, 2), " ").concat(_totalStorage.unit)}
        </p>
        <div className="flex h-[200px] w-[200px] items-center justify-center">
          <pie_1.ResponsivePie data={storageData} margin={{ top: 15, right: 15, bottom: 15, left: 15 }} innerRadius={0.3} padAngle={2} cornerRadius={4} activeOuterRadiusOffset={8} colors={getPieChartEntryColor} borderWidth={0} borderColor={{
            from: "color",
            modifiers: [["darker", 0.2]]
        }} valueFormat={function (value) {
            var formatted = (0, unitUtils_1.bytesToShrink)(value);
            return "".concat((0, mathHelpers_1.roundDecimal)(formatted.value, 2), " ").concat(formatted.unit);
        }} enableArcLinkLabels={false} arcLabelsSkipAngle={30} theme={pieTheme} tooltip={TooltipLabel}/>
        </div>
      </div>
    </div>);
};
var useData = function (active, available) {
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var tw = (0, useTailwind_1.default)();
    return [
        {
            id: "active",
            label: "Active",
            value: active,
            color: tw.theme.colors["primary"].DEFAULT
        },
        {
            id: "available",
            label: "Available",
            value: available,
            color: resolvedTheme === "dark" ? tw.theme.colors.neutral[800] : tw.theme.colors.neutral[500]
        }
    ];
};
function useStorageData(props) {
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var tw = (0, useTailwind_1.default)();
    return [
        {
            id: "active-ephemeral",
            label: "Active emphemeral",
            color: tw.theme.colors["primary"].DEFAULT,
            value: props.activeEphemeralStorage + props.pendingEphemeralStorage
        },
        {
            id: "active-persistent",
            label: "Active persistent",
            color: tw.theme.colors["primary"].visited,
            value: props.activePersistentStorage + props.pendingPersistentStorage
        },
        {
            id: "available-emphemeral",
            label: "Available emphemeral",
            color: resolvedTheme === "dark" ? tw.theme.colors.neutral[800] : tw.theme.colors.neutral[500],
            value: props.availableEphemeralStorage
        },
        {
            id: "available-persistent",
            label: "Available persistent",
            color: resolvedTheme === "dark" ? tw.theme.colors.neutral[600] : tw.theme.colors.neutral[300],
            value: props.availablePersistentStorage
        }
    ];
}
var usePieTheme = function () {
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var tw = (0, useTailwind_1.default)();
    return {
        text: {
            fill: "#fff",
            fontSize: 12
        },
        tooltip: {
            basic: {
                color: resolvedTheme === "dark" ? tw.theme.colors.white : tw.theme.colors.current
            },
            container: {
                backgroundColor: resolvedTheme === "dark" ? tw.theme.colors.neutral[700] : tw.theme.colors.white
            }
        }
    };
};
var TooltipLabel = function (_a) {
    var datum = _a.datum;
    return (<tooltip_1.BasicTooltip id={datum.label} value={datum.formattedValue} enableChip={true} color={datum.color}/>);
};
exports.default = NetworkCapacity;
