"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useThrottledCallback = void 0;
var react_1 = require("react");
var throttle_1 = require("lodash/throttle");
var useThrottledCallback = function (effect, deps, delay) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return (0, react_1.useCallback)((0, throttle_1.default)(function () {
        effect();
    }, delay), __spreadArray(__spreadArray([], (deps || []), true), [delay], false));
};
exports.useThrottledCallback = useThrottledCallback;
