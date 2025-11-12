"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HumanReadableBytes = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var unitUtils_1 = require("@src/utils/unitUtils");
var HumanReadableBytes = function (_a) {
    var value = _a.value;
    if (typeof value !== "number")
        return null;
    var result = (0, unitUtils_1.bytesToShrink)(value);
    return (<>
      <react_intl_1.FormattedNumber value={result.value} maximumFractionDigits={2}/>
      <span className="pl-2 text-sm">{result.unit}</span>
    </>);
};
exports.HumanReadableBytes = HumanReadableBytes;
