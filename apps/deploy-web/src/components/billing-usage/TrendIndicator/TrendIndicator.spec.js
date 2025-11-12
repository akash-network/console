"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("@testing-library/jest-dom");
var react_1 = require("react");
var date_fns_1 = require("date-fns");
var TrendIndicator_1 = require("@src/components/billing-usage/TrendIndicator/TrendIndicator");
var react_2 = require("@testing-library/react");
var usage_1 = require("@tests/seeders/usage");
describe(TrendIndicator_1.TrendIndicator.name, function () {
    it("renders increased trend indicator when last value is higher than first value", function () {
        setup({
            isFetching: false,
            data: [
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 5), totalUsdSpent: 100 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 3), totalUsdSpent: 120 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 1), totalUsdSpent: 150 })
            ],
            field: "totalUsdSpent"
        });
        expect(react_2.screen.getByText("Trending up by 50%")).toBeInTheDocument();
        expect(react_2.screen.getByText("Graph Up")).toBeInTheDocument();
        expect(react_2.screen.queryByText("Graph Down")).not.toBeInTheDocument();
        expect(react_2.screen.queryByText("today")).not.toBeInTheDocument();
    });
    it("renders decreased trend indicator when last value is lower than first value", function () {
        setup({
            isFetching: false,
            data: [
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 5), totalUsdSpent: 300 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 3), totalUsdSpent: 200 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 1), totalUsdSpent: 100 })
            ],
            field: "totalUsdSpent"
        });
        expect(react_2.screen.getByText("Trending down by 66.67%")).toBeInTheDocument();
        expect(react_2.screen.queryByText("Graph Up")).not.toBeInTheDocument();
        expect(react_2.screen.getByText("Graph Down")).toBeInTheDocument();
        expect(react_2.screen.queryByText("today")).not.toBeInTheDocument();
    });
    it("shows 'today' when last data point is from today", function () {
        setup({
            isFetching: false,
            data: [(0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 2), totalUsdSpent: 100 }), (0, usage_1.buildUsageHistoryItem)({ date: new Date(), totalUsdSpent: 150 })],
            field: "totalUsdSpent"
        });
        expect(react_2.screen.getByText("Trending up by 50%")).toBeInTheDocument();
        expect(react_2.screen.getByText("Graph Up")).toBeInTheDocument();
        expect(react_2.screen.getByText("today")).toBeInTheDocument();
    });
    it("does not render when data has less than 2 items", function () {
        setup({
            isFetching: false,
            data: [(0, usage_1.buildUsageHistoryItem)({ date: new Date(), totalUsdSpent: 100 })],
            field: "totalUsdSpent"
        });
        expect(react_2.screen.queryByText(/Trending/)).not.toBeInTheDocument();
    });
    it("does not render when first value is 0 (to avoid division by zero)", function () {
        setup({
            isFetching: false,
            data: [(0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 2), totalUsdSpent: 0 }), (0, usage_1.buildUsageHistoryItem)({ date: new Date(), totalUsdSpent: 150 })],
            field: "totalUsdSpent"
        });
        expect(react_2.screen.queryByText(/Trending/)).not.toBeInTheDocument();
    });
    it("does not render when change is 0%", function () {
        setup({
            isFetching: false,
            data: [(0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 2), totalUsdSpent: 100 }), (0, usage_1.buildUsageHistoryItem)({ date: new Date(), totalUsdSpent: 100 })],
            field: "totalUsdSpent"
        });
        expect(react_2.screen.queryByText(/Trending/)).not.toBeInTheDocument();
    });
    it("does not render when isFetching is true", function () {
        setup({
            isFetching: true,
            data: [(0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 2), totalUsdSpent: 100 }), (0, usage_1.buildUsageHistoryItem)({ date: new Date(), totalUsdSpent: 150 })],
            field: "totalUsdSpent"
        });
        expect(react_2.screen.queryByText(/Trending/)).not.toBeInTheDocument();
    });
    it("filters out items with undefined values before comparison", function () {
        setup({
            isFetching: false,
            data: [
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 4), totalUsdSpent: 100 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 2), totalUsdSpent: undefined }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 1), totalUsdSpent: 200 })
            ],
            field: "totalUsdSpent"
        });
        expect(react_2.screen.getByText("Trending up by 100%")).toBeInTheDocument();
        expect(react_2.screen.getByText("Graph Up")).toBeInTheDocument();
    });
    function setup(props) {
        var _a, _b;
        var defaultProps = {
            components: {
                GraphUp: function () { return <div>Graph Up</div>; },
                GraphDown: function () { return <div>Graph Down</div>; }
            },
            isFetching: (_a = props.isFetching) !== null && _a !== void 0 ? _a : false,
            data: (_b = props.data) !== null && _b !== void 0 ? _b : [
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 6), totalUsdSpent: 100 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 5), totalUsdSpent: 150 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 4), totalUsdSpent: 200 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 3), totalUsdSpent: 250 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 2), totalUsdSpent: 300 }),
                (0, usage_1.buildUsageHistoryItem)({ date: (0, date_fns_1.subDays)(new Date(), 1), totalUsdSpent: 350 }),
                (0, usage_1.buildUsageHistoryItem)({ date: new Date(), totalUsdSpent: 400 })
            ],
            field: "totalUsdSpent"
        };
        (0, react_2.render)(<TrendIndicator_1.TrendIndicator {...defaultProps}/>);
    }
});
