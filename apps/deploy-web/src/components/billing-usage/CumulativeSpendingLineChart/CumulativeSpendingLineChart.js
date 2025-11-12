"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CumulativeSpendingLineChart = exports.COMPONENTS = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var date_fns_1 = require("date-fns");
var recharts_1 = require("recharts");
var TrendIndicator_1 = require("@src/components/billing-usage/TrendIndicator/TrendIndicator");
var chartConfig = {
    totalUsdSpent: {
        label: "Total USD Spent"
    }
};
exports.COMPONENTS = {
    LineChart: recharts_1.LineChart
};
var CumulativeSpendingLineChart = function (_a) {
    var isFetching = _a.isFetching, data = _a.data, _b = _a.components, C = _b === void 0 ? exports.COMPONENTS : _b;
    return (<components_1.Card>
      <components_1.CardHeader className="flex flex-row items-center gap-3 space-y-0 px-6">
        <components_1.CardTitle className="text-lg">Cumulative Spending</components_1.CardTitle>
        {isFetching && <components_1.Spinner size="small" variant="dark"/>}
      </components_1.CardHeader>
      <components_1.CardContent>
        <components_1.ChartContainer config={chartConfig} className={(0, utils_1.cn)("h-[298px] w-full", isFetching && "pointer-events-none")} role="chart-container">
          <C.LineChart accessibilityLayer data={data} margin={{
            left: 12,
            right: 12
        }} role="line-chart">
            <recharts_1.CartesianGrid vertical={false}/>
            <recharts_1.XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={function (value) {
            var date = new Date(value);
            return isNaN(date.getTime()) ? value : (0, date_fns_1.format)(date, "M/d");
        }}/>
            <components_1.ChartTooltip content={<components_1.ChartTooltipContent className="w-[180px]" nameKey="totalUsdSpent" labelFormatter={function (value) {
                var date = new Date(value);
                return isNaN(date.getTime()) ? value : (0, date_fns_1.format)(date, "MMM d, yyyy");
            }}/>}/>
            <recharts_1.Line dataKey="totalUsdSpent" type="linear" stroke="hsl(var(--primary))" dot={{
            fill: "hsl(var(--primary))"
        }} strokeWidth={2} className={(0, utils_1.cn)(isFetching && "opacity-50")}/>
          </C.LineChart>
        </components_1.ChartContainer>
        <TrendIndicator_1.TrendIndicator isFetching={isFetching} data={data} field="totalUsdSpent"/>
      </components_1.CardContent>
    </components_1.Card>);
};
exports.CumulativeSpendingLineChart = CumulativeSpendingLineChart;
