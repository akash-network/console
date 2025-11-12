"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyUsageBarChart = exports.COMPONENTS = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var date_fns_1 = require("date-fns");
var recharts_1 = require("recharts");
var chartConfig = {
    dailyUsdSpent: {
        label: "USD Spent"
    }
};
exports.COMPONENTS = {
    BarChart: recharts_1.BarChart
};
var DailyUsageBarChart = function (_a) {
    var isFetching = _a.isFetching, data = _a.data, _b = _a.components, C = _b === void 0 ? exports.COMPONENTS : _b;
    return (<components_1.Card className="w-full py-0">
      <components_1.CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b px-6">
        <components_1.CardTitle className="text-lg">Daily Usage</components_1.CardTitle>
        {isFetching && <components_1.Spinner size="small" variant="dark"/>}
      </components_1.CardHeader>
      <components_1.CardContent className="px-2 sm:p-6">
        <components_1.ChartContainer config={chartConfig} className={(0, utils_1.cn)("aspect-auto h-[250px] w-full", isFetching && "pointer-events-none")} role="chart-container">
          <C.BarChart accessibilityLayer data={data} margin={{
            left: 12,
            right: 12
        }} role="bar-chart">
            <recharts_1.CartesianGrid vertical={false}/>
            <recharts_1.XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={10} tickFormatter={function (value) {
            var date = new Date(value);
            return isNaN(date.getTime()) ? value : (0, date_fns_1.format)(new Date(value), "M/d");
        }}/>
            <components_1.ChartTooltip content={<components_1.ChartTooltipContent className="w-[150px]" nameKey="dailyUsdSpent" labelFormatter={function (value) {
                var date = new Date(value);
                return isNaN(date.getTime()) ? value : (0, date_fns_1.format)(new Date(value), "MMM d, yyyy");
            }}/>}/>
            <recharts_1.Bar dataKey="dailyUsdSpent" fill="hsl(var(--primary))" className={(0, utils_1.cn)(isFetching && "opacity-80")}/>
          </C.BarChart>
        </components_1.ChartContainer>
      </components_1.CardContent>
    </components_1.Card>);
};
exports.DailyUsageBarChart = DailyUsageBarChart;
