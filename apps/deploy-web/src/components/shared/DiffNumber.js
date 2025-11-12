"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffNumber = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var DiffNumber = function (_a) {
    var value = _a.value, _b = _a.className, className = _b === void 0 ? "" : _b, _c = _a.unit, unit = _c === void 0 ? "" : _c;
    if (typeof value !== "number")
        return null;
    var isPositiveDiff = value >= 0;
    return (<span className={className}>
      {isPositiveDiff ? "+" : null}
      <react_intl_1.FormattedNumber value={value} maximumFractionDigits={2}/>
      {unit && " ".concat(unit)}
    </span>);
};
exports.DiffNumber = DiffNumber;
