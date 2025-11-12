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
exports.UsageView = exports.COMPONENTS = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var LinearProgress_1 = require("@mui/material/LinearProgress");
var date_fns_1 = require("date-fns");
var iconoir_react_1 = require("iconoir-react");
var CumulativeSpendingLineChart_1 = require("@src/components/billing-usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart");
var DailyUsageBarChart_1 = require("@src/components/billing-usage/DailyUsageBarChart/DailyUsageBarChart");
var Title_1 = require("@src/components/shared/Title");
var domUtils_1 = require("@src/utils/domUtils");
var stringUtils_1 = require("@src/utils/stringUtils");
var isValidNumber = function (value) {
    return value !== null && value !== undefined && !Number.isNaN(value) && Number.isFinite(value);
};
exports.COMPONENTS = {
    FormattedNumber: react_intl_1.FormattedNumber,
    Title: Title_1.Title,
    DailyUsageBarChart: DailyUsageBarChart_1.DailyUsageBarChart,
    CumulativeSpendingLineChart: CumulativeSpendingLineChart_1.CumulativeSpendingLineChart,
    LinearProgress: LinearProgress_1.default,
    DateRangePicker: components_1.DateRangePicker
};
var UsageView = function (_a) {
    var usageHistoryData = _a.usageHistoryData, usageHistoryStatsData = _a.usageHistoryStatsData, isFetchingUsageHistory = _a.isFetchingUsageHistory, isUsageHistoryError = _a.isUsageHistoryError, isFetchingUsageHistoryStats = _a.isFetchingUsageHistoryStats, isUsageHistoryStatsError = _a.isUsageHistoryStatsError, dateRange = _a.dateRange, onDateRangeChange = _a.onDateRangeChange, _b = _a.components, components = _b === void 0 ? exports.COMPONENTS : _b;
    var oneYearAgo = (0, date_fns_1.startOfDay)((0, date_fns_1.subYears)(new Date(), 1));
    var FormattedNumber = components.FormattedNumber, Title = components.Title, DailyUsageBarChart = components.DailyUsageBarChart, CumulativeSpendingLineChart = components.CumulativeSpendingLineChart, LinearProgress = components.LinearProgress, DateRangePicker = components.DateRangePicker;
    var exportCsv = react_1.default.useCallback(function () {
        var statsCsvContent = [
            "Usage Stats",
            "Total Spent,Average Spent Per Day,Total Deployments,Average Deployments Per Day",
            [
                usageHistoryStatsData.totalSpent,
                usageHistoryStatsData.averageSpentPerDay,
                usageHistoryStatsData.totalDeployments,
                usageHistoryStatsData.averageDeploymentsPerDay
            ]
                .map(stringUtils_1.sanitizeCsvField)
                .join(",")
        ];
        var historyCsvContent = __spreadArray([
            "Usage History",
            "Date,Active Deployments,Daily AKT Spent,Total AKT Spent,Daily USDC Spent,Total USDC Spent,Daily USD Spent,Total USD Spent"
        ], usageHistoryData.map(function (row) {
            return [row.date, row.activeDeployments, row.dailyAktSpent, row.totalAktSpent, row.dailyUsdcSpent, row.totalUsdcSpent, row.dailyUsdSpent, row.totalUsdSpent]
                .map(stringUtils_1.sanitizeCsvField)
                .join(",");
        }), true);
        var combinedCsvContent = __spreadArray(__spreadArray([], statsCsvContent, true), historyCsvContent, true).join("\n");
        var blob = new Blob([combinedCsvContent], { type: "text/csv;charset=utf-8;" });
        (0, domUtils_1.downloadCsv)(blob, "akash_billing_usage");
    }, [usageHistoryData, usageHistoryStatsData]);
    return (<div className="h-full space-y-4">
      <Title subTitle>Overview</Title>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <components_1.Label>Filter by Date:</components_1.Label>
          <DateRangePicker date={dateRange} onChange={onDateRangeChange} className="w-full" minDate={oneYearAgo} maxDate={(0, date_fns_1.endOfToday)()} maxRangeInDays={366}/>
        </div>
        <components_1.Button variant="secondary" onClick={exportCsv} size="sm">
          <iconoir_react_1.Download width={16} className="mr-2"/>
          Export CSV
        </components_1.Button>
      </div>

      {isUsageHistoryStatsError && (<div className="flex h-full items-center justify-center">
          <p className="text-red-500">Error loading usage stats</p>
        </div>)}

      {!isUsageHistoryStatsError && (<div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-8">
          <components_1.Card className="flex min-h-28 basis-1/2 flex-col">
            <components_1.CardHeader className="flex flex-row items-center justify-between pb-0">
              <components_1.CardTitle className="text-base">Total Spent</components_1.CardTitle>
              <iconoir_react_1.Dollar color="#71717a" width={18}/>
            </components_1.CardHeader>
            {isFetchingUsageHistoryStats ? (<div className="flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-11/12"/>
              </div>) : (<components_1.CardContent className="pt-2">
                {isValidNumber(usageHistoryStatsData.totalSpent) ? (<div className="text-3xl font-bold">
                    <FormattedNumber value={usageHistoryStatsData.totalSpent} style="currency" currency="USD" currencyDisplay="narrowSymbol"/>
                  </div>) : (<p className="text-gray-400">No data</p>)}
                {isValidNumber(usageHistoryStatsData.averageSpentPerDay) && (<div className="text-sm font-semibold text-gray-400">
                    <FormattedNumber value={usageHistoryStatsData.averageSpentPerDay} style="currency" currency="USD" currencyDisplay="narrowSymbol"/> average
                    per day
                  </div>)}
              </components_1.CardContent>)}
          </components_1.Card>
          <components_1.Card className="flex min-h-28 basis-1/2 flex-col">
            <components_1.CardHeader className="flex flex-row items-center justify-between pb-0">
              <components_1.CardTitle className="text-base">Total Deployments</components_1.CardTitle>
              <iconoir_react_1.Cloud color="#71717a" width={18}/>
            </components_1.CardHeader>
            {isFetchingUsageHistoryStats ? (<div className="flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-11/12"/>
              </div>) : (<components_1.CardContent className="pt-2">
                {isValidNumber(usageHistoryStatsData.totalDeployments) ? (<div className="text-3xl font-bold">
                    <FormattedNumber value={usageHistoryStatsData.totalDeployments}/>
                  </div>) : (<p className="text-gray-400">No data</p>)}
                {isValidNumber(usageHistoryStatsData.averageDeploymentsPerDay) && (<div className="text-sm font-semibold text-gray-400">
                    <FormattedNumber value={usageHistoryStatsData.averageDeploymentsPerDay}/> average per day
                  </div>)}
              </components_1.CardContent>)}
          </components_1.Card>
        </div>)}

      <Title subTitle>Historical</Title>

      {isUsageHistoryError && (<div className="flex h-full items-center justify-center">
          <p className="text-red-500">Error loading usage data</p>
        </div>)}

      {!isUsageHistoryError && (<>
          <DailyUsageBarChart data={usageHistoryData} isFetching={isFetchingUsageHistory}/>
          <CumulativeSpendingLineChart data={usageHistoryData} isFetching={isFetchingUsageHistory}/>
        </>)}
    </div>);
};
exports.UsageView = UsageView;
