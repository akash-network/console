"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeRange = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var graph_config_1 = require("@src/config/graph.config");
var TimeRange = function (_a) {
    var _b, _c, _d;
    var selectedRange = _a.selectedRange, onRangeChange = _a.onRangeChange;
    var _onRangeChange = function (selectedRange) {
        onRangeChange(selectedRange);
    };
    return (<components_1.ToggleGroup type="single" aria-label="Graph range select" color="secondary" size="sm" className="mx-auto my-0 sm:mx-0">
      <components_1.ToggleGroupItem value="7D" className={(0, utils_1.cn)((_b = {}, _b["!bg-primary font-bold !text-white"] = selectedRange === graph_config_1.SELECTED_RANGE_VALUES["7D"], _b))} onClick={function () { return _onRangeChange(graph_config_1.SELECTED_RANGE_VALUES["7D"]); }} size="sm">
        7D
      </components_1.ToggleGroupItem>
      <components_1.ToggleGroupItem value="1M" className={(0, utils_1.cn)((_c = {}, _c["!bg-primary font-bold !text-white"] = selectedRange === graph_config_1.SELECTED_RANGE_VALUES["1M"], _c))} onClick={function () { return _onRangeChange(graph_config_1.SELECTED_RANGE_VALUES["1M"]); }} size="sm">
        1M
      </components_1.ToggleGroupItem>
      <components_1.ToggleGroupItem value="ALL" className={(0, utils_1.cn)((_d = {}, _d["!bg-primary font-bold !text-white"] = selectedRange === graph_config_1.SELECTED_RANGE_VALUES["ALL"], _d))} onClick={function () { return _onRangeChange(graph_config_1.SELECTED_RANGE_VALUES["ALL"]); }} size="sm">
        ALL
      </components_1.ToggleGroupItem>
    </components_1.ToggleGroup>);
};
exports.TimeRange = TimeRange;
