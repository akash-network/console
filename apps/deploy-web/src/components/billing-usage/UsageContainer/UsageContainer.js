"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageContainer = void 0;
var react_1 = require("react");
var WalletProvider_1 = require("@src/context/WalletProvider");
var queries_1 = require("@src/queries");
var dateUtils_1 = require("@src/utils/dateUtils");
var DEPENDENCIES = {
    useWallet: WalletProvider_1.useWallet,
    useUsage: queries_1.useUsage,
    useUsageStats: queries_1.useUsageStats
};
var UsageContainer = function (_a) {
    var children = _a.children, _b = _a.dependencies, d = _b === void 0 ? DEPENDENCIES : _b;
    var _c = react_1.default.useState(function () { return (0, dateUtils_1.createDateRange)(); }), dateRange = _c[0], setDateRange = _c[1];
    var address = d.useWallet().address;
    var _d = d.useUsage({
        address: address,
        startDate: dateRange.from,
        endDate: dateRange.to
    }), _e = _d.data, usageHistoryData = _e === void 0 ? [] : _e, isUsageHistoryError = _d.isError, isFetchingUsageHistory = _d.isFetching;
    var _f = d.useUsageStats({
        address: address,
        startDate: dateRange.from,
        endDate: dateRange.to
    }), _g = _f.data, usageHistoryStatsData = _g === void 0 ? {
        totalSpent: 0,
        averageSpentPerDay: 0,
        totalDeployments: 0,
        averageDeploymentsPerDay: 0
    } : _g, isUsageHistoryStatsError = _f.isError, isFetchingUsageHistoryStats = _f.isFetching;
    var changeDateRange = function (range) {
        setDateRange((0, dateUtils_1.createDateRange)(range));
    };
    return (<>
      {children({
            usageHistoryData: usageHistoryData,
            usageHistoryStatsData: usageHistoryStatsData,
            isFetchingUsageHistory: isFetchingUsageHistory,
            isUsageHistoryError: isUsageHistoryError,
            isFetchingUsageHistoryStats: isFetchingUsageHistoryStats,
            isUsageHistoryStatsError: isUsageHistoryStatsError,
            dateRange: dateRange,
            onDateRangeChange: changeDateRange
        })}
    </>);
};
exports.UsageContainer = UsageContainer;
