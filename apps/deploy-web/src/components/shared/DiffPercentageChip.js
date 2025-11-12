"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffPercentageChip = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var DiffPercentageChip = function (_a) {
    var value = _a.value, _b = _a.size, size = _b === void 0 ? "small" : _b, _c = _a.className, className = _c === void 0 ? "" : _c;
    if (typeof value !== "number")
        return null;
    var isPositiveDiff = value >= 0;
    return (<span className={(0, utils_1.cn)(className, "flex items-center font-bold", {
            "text-red-400": !isPositiveDiff,
            "text-green-600": isPositiveDiff,
            "text-sm": size === "small",
            "text-base": size === "medium"
        })}>
      {isPositiveDiff ? <iconoir_react_1.ArrowUp className="text-xs"/> : <iconoir_react_1.ArrowDown className="text-xs"/>}
      <span className="ml-1">
        <react_intl_1.FormattedNumber style="percent" maximumFractionDigits={2} value={Math.abs(value)}/>
      </span>
    </span>);
};
exports.DiffPercentageChip = DiffPercentageChip;
