"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
var react_intl_1 = require("react-intl");
var styles_1 = require("@mui/material/styles");
var useMediaQuery_1 = require("@mui/material/useMediaQuery");
var line_1 = require("@nivo/line");
var next_themes_1 = require("next-themes");
var graph_config_1 = require("@src/config/graph.config");
var colors_1 = require("@src/utils/colors");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var Graph = function (_a) {
    var rangedData = _a.rangedData, snapshotMetadata = _a.snapshotMetadata, snapshotData = _a.snapshotData, snapshot = _a.snapshot, selectedRange = _a.selectedRange;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var intl = (0, react_intl_1.useIntl)();
    var graphTheme = getTheme(resolvedTheme);
    var muiTheme = (0, styles_1.useTheme)();
    var smallScreen = (0, useMediaQuery_1.default)(muiTheme.breakpoints.down("sm"));
    var minValue = rangedData && snapshotMetadata.unitFn(rangedData.map(function (x) { return x.value || 0; }).reduce(function (a, b) { return (a < b ? a : b); })).value;
    var maxValue = snapshotData && snapshotMetadata.unitFn(rangedData.map(function (x) { return x.value || 0; }).reduce(function (a, b) { return (a > b ? a : b); })).value;
    var graphData = snapshotData
        ? [
            {
                id: snapshot,
                color: "rgb(1,0,0)",
                data: rangedData
                    .map(function (_snapshot) { return ({
                    x: _snapshot.date,
                    y: (0, mathHelpers_1.roundDecimal)(snapshotMetadata.unitFn(_snapshot.value).value)
                }); })
                    .sort(function (a, b) {
                    return Number(new Date(a.x)) - Number(new Date(b.x));
                })
            }
        ]
        : [];
    var graphMetadata = getGraphMetadataPerRange(selectedRange);
    return (<div className="relative h-[400px]">
      <line_1.ResponsiveLineCanvas theme={graphTheme} data={graphData} curve="linear" margin={{ top: 30, right: 35, bottom: 50, left: 55 }} xScale={{ type: "point" }} yScale={{
            type: "linear",
            min: minValue * 0.98,
            max: maxValue * 1.02
        }} yFormat=" >-1d" axisBottom={{
            tickRotation: smallScreen ? 45 : 0,
            format: function (dateStr) { return intl.formatDate(dateStr, { day: "numeric", month: "short", timeZone: "utc" }); },
            tickValues: getTickValues(rangedData, graphMetadata.xModulo)
        }} axisLeft={{
            format: function (val) { return (0, mathHelpers_1.nFormatter)(val, 2); },
            legend: snapshotMetadata.legend,
            legendOffset: -45,
            legendPosition: "middle"
        }} axisTop={null} axisRight={null} colors={colors_1.customColors.akashRed} pointSize={graphMetadata.size} pointBorderColor={colors_1.customColors.akashRed} pointColor={"#ffffff"} pointBorderWidth={graphMetadata.border} isInteractive={true} tooltip={function (props) { return (<div className="rounded-sm bg-primary px-3 py-2 leading-4 text-primary-foreground">
            <div className="mb-1 text-xs">
              <react_intl_1.FormattedDate value={new Date(props.point.data.x)} day="numeric" month="long" timeZone="UTC" year="2-digit"/>
            </div>
            <div className="font-bold">{(0, mathHelpers_1.nFormatter)(props.point.data.y, 2)}</div>
          </div>); }} enableGridX={false} enableCrosshair={true}/>
    </div>);
};
var getTheme = function (theme) {
    // TODO Use the same colors as the theme
    var color = theme === "dark" ? colors_1.customColors.white : colors_1.customColors.black;
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
var getGraphMetadataPerRange = function (range) {
    switch (range) {
        case graph_config_1.SELECTED_RANGE_VALUES["7D"]:
            return {
                size: 10,
                border: 3,
                xModulo: 1
            };
        case graph_config_1.SELECTED_RANGE_VALUES["1M"]:
            return {
                size: 6,
                border: 2,
                xModulo: 3
            };
        case graph_config_1.SELECTED_RANGE_VALUES["ALL"]:
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
var getTickValues = function (rangedData, modulo) {
    var values = rangedData.reverse().filter(function (data, i) { return i % modulo === 0; });
    var maxLength = 10;
    if (values.length > maxLength) {
        var mod_1 = Math.round(rangedData.length / maxLength);
        return rangedData.filter(function (data, i) { return i % mod_1 === 0; }).map(function (data) { return data.date; });
    }
    else {
        return values.map(function (data) { return data.date; });
    }
};
exports.default = Graph;
