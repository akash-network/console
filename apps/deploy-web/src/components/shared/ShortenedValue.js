"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortenedValue = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var useShortText_1 = require("@src/hooks/useShortText");
var ShortenedValue = function (_a) {
    var value = _a.value, maxLength = _a.maxLength, headLength = _a.headLength;
    var defaultHeadLength = (0, react_1.useMemo)(function () {
        return Math.floor((maxLength - useShortText_1.SPLIT_TEXT_GLUE.length) / 2);
    }, [maxLength]);
    var tailLength = (0, react_1.useMemo)(function () {
        return maxLength - (headLength !== null && headLength !== void 0 ? headLength : defaultHeadLength) - useShortText_1.SPLIT_TEXT_GLUE.length;
    }, [defaultHeadLength, headLength, maxLength]);
    return value.length > maxLength ? (<components_1.CustomTooltip title={value}>
      <span>{(0, useShortText_1.getSplitText)(value, headLength !== null && headLength !== void 0 ? headLength : defaultHeadLength, tailLength)}</span>
    </components_1.CustomTooltip>) : (<>{value}</>);
};
exports.ShortenedValue = ShortenedValue;
