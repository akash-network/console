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
Object.defineProperty(exports, "__esModule", { value: true });
require("@testing-library/jest-dom");
var react_1 = require("react");
var UsageView_1 = require("@src/components/billing-usage/UsageView/UsageView");
var react_2 = require("@testing-library/react");
var usage_1 = require("@tests/seeders/usage");
var mocks_1 = require("@tests/unit/mocks");
describe(UsageView_1.UsageView.name, function () {
    it("renders an error message when stats fail to load", function () {
        setup({ isUsageHistoryStatsError: true });
        expect(react_2.screen.queryByText("Error loading usage stats")).toBeInTheDocument();
    });
    it("renders two progress bars while stats are fetching", function () {
        setup({ isFetchingUsageHistoryStats: true });
        var bars = react_2.screen.getAllByRole("progressbar");
        expect(bars).toHaveLength(2);
    });
    it("displays usage stats data when available", function () {
        var usageHistoryStatsData = setup({
            usageHistoryStatsData: {
                totalSpent: 100,
                averageSpentPerDay: 7,
                totalDeployments: 3,
                averageDeploymentsPerDay: 0.5
            }
        }).usageHistoryStatsData;
        expect(react_2.screen.getByText(usageHistoryStatsData.totalSpent)).toBeInTheDocument();
        expect(react_2.screen.getByText(function (_, element) {
            return (element === null || element === void 0 ? void 0 : element.textContent) === "7 average per day";
        })).toBeInTheDocument();
        expect(react_2.screen.getByText("3")).toBeInTheDocument();
        expect(react_2.screen.getByText(function (_, element) {
            return (element === null || element === void 0 ? void 0 : element.textContent) === "0.5 average per day";
        })).toBeInTheDocument();
    });
    it("renders an error message when history data fails to load", function () {
        setup({ isUsageHistoryError: true });
        expect(react_2.screen.getByText("Error loading usage data")).toBeInTheDocument();
    });
    it("renders charts with correct data and loading state", function () {
        var usageHistoryData = setup({ isFetchingUsageHistory: true }).usageHistoryData;
        var daily = react_2.screen.getByTestId("daily-chart");
        expect(daily).toHaveAttribute("data-fetching", "true");
        expect(daily).toHaveTextContent(JSON.stringify(usageHistoryData));
        var cumulative = react_2.screen.getByTestId("cumulative-chart");
        expect(cumulative).toHaveAttribute("data-fetching", "true");
    });
    it("renders charts in non-loading state by default", function () {
        setup();
        expect(react_2.screen.getByTestId("daily-chart")).toHaveAttribute("data-fetching", "false");
        expect(react_2.screen.getByTestId("cumulative-chart")).toHaveAttribute("data-fetching", "false");
    });
    it("calls onDateRangeChange when date range start changes", function () {
        var onDateRangeChange = jest.fn();
        setup({
            onDateRangeChange: onDateRangeChange,
            dateRange: {
                from: new Date(),
                to: new Date("2030-01-01")
            }
        });
        react_2.fireEvent.change(react_2.screen.getByLabelText("Filter by start date"), {
            target: { value: "2025-01-01" }
        });
        expect(onDateRangeChange).toHaveBeenCalledWith({
            from: new Date("2025-01-01"),
            to: new Date("2030-01-01")
        });
    });
    it("calls onDateRangeChange when date range end changes", function () {
        var onDateRangeChange = jest.fn();
        setup({
            onDateRangeChange: onDateRangeChange,
            dateRange: {
                to: new Date(),
                from: new Date("2020-01-01")
            }
        });
        react_2.fireEvent.change(react_2.screen.getByLabelText("Filter by end date"), {
            target: { value: "2025-01-01" }
        });
        expect(onDateRangeChange).toHaveBeenCalledWith({
            from: new Date("2020-01-01"),
            to: new Date("2025-01-01")
        });
    });
    function setup(props) {
        var _a, _b;
        if (props === void 0) { props = {}; }
        var defaultComponents = {
            FormattedNumber: function (_a) {
                var value = _a.value;
                return <span>{value}</span>;
            },
            Title: function (_a) {
                var children = _a.children;
                return <div>{children}</div>;
            },
            DailyUsageBarChart: function (_a) {
                var data = _a.data, isFetching = _a.isFetching;
                return (<div data-testid="daily-chart" data-fetching={String(isFetching)}>
          {JSON.stringify(data)}
        </div>);
            },
            CumulativeSpendingLineChart: function (_a) {
                var data = _a.data, isFetching = _a.isFetching;
                return (<div data-testid="cumulative-chart" data-fetching={String(isFetching)}>
          {JSON.stringify(data)}
        </div>);
            },
            LinearProgress: function (props) { return <div role="progressbar" {...props}/>; },
            DateRangePicker: function (_a) {
                var _b = _a.date, date = _b === void 0 ? props.dateRange : _b, onChange = _a.onChange;
                return (<div>
          <label>
            <span>Filter by start date</span>
            <input type="date" value={(date === null || date === void 0 ? void 0 : date.from) ? date.from.toISOString().split("T")[0] : ""} onChange={function (e) { return onChange === null || onChange === void 0 ? void 0 : onChange({ from: new Date(e.target.value), to: (date === null || date === void 0 ? void 0 : date.to) || new Date() }); }}/>
          </label>
          <label>
            <span>Filter by end date</span>
            <input type="date" value={(date === null || date === void 0 ? void 0 : date.to) ? date.to.toISOString().split("T")[0] : ""} onChange={function (e) { return onChange === null || onChange === void 0 ? void 0 : onChange({ from: (date === null || date === void 0 ? void 0 : date.from) || new Date(), to: new Date(e.target.value) }); }}/>
          </label>
        </div>);
            }
        };
        var defaultProps = __assign({ usageHistoryData: (_a = props.usageHistoryData) !== null && _a !== void 0 ? _a : (0, usage_1.buildUsageHistory)(), usageHistoryStatsData: (0, usage_1.buildUsageHistoryStats)(props.usageHistoryStatsData), isFetchingUsageHistory: false, isUsageHistoryError: false, isFetchingUsageHistoryStats: false, isUsageHistoryStatsError: false, dateRange: { from: new Date(), to: new Date() }, onDateRangeChange: (_b = props.onDateRangeChange) !== null && _b !== void 0 ? _b : jest.fn(), components: (0, mocks_1.MockComponents)(UsageView_1.COMPONENTS, __assign(__assign({}, defaultComponents), props.components)) }, props);
        (0, react_2.render)(<UsageView_1.UsageView {...defaultProps}/>);
        return defaultProps;
    }
});
