"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.useUsage = useUsage;
exports.useUsageStats = useUsageStats;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var queryKeys_1 = require("./queryKeys");
function useUsage(params, options) {
    var _a, _b;
    var usage = (0, ServicesProvider_1.useServices)().usage;
    return (0, react_query_1.useQuery)(__assign({ queryKey: __spreadArray([], queryKeys_1.QueryKeys.getUsageDataKey(params.address, (_a = params.startDate) === null || _a === void 0 ? void 0 : _a.toISOString(), (_b = params.endDate) === null || _b === void 0 ? void 0 : _b.toISOString()), true), queryFn: function () { return usage.getUsage(params); } }, options));
}
function useUsageStats(params, options) {
    var _a, _b;
    var usage = (0, ServicesProvider_1.useServices)().usage;
    return (0, react_query_1.useQuery)(__assign({ queryKey: __spreadArray([], queryKeys_1.QueryKeys.getUsageStatsDataKey(params.address, (_a = params.startDate) === null || _a === void 0 ? void 0 : _a.toISOString(), (_b = params.endDate) === null || _b === void 0 ? void 0 : _b.toISOString()), true), queryFn: function () { return usage.getUsageStats(params); } }, options));
}
