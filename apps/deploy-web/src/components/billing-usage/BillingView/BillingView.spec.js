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
var components_1 = require("@akashnetwork/ui/components");
var jest_mock_extended_1 = require("jest-mock-extended");
var BillingView_1 = require("./BillingView");
var react_2 = require("@testing-library/react");
var payment_1 = require("@tests/seeders/payment");
describe(BillingView_1.BillingView.name, function () {
    it("shows spinner when fetching", function () {
        setup({ isFetching: true });
        expect(react_2.screen.getByRole("status")).toBeInTheDocument();
    });
    it("shows error alert when error", function () {
        setup({ isError: true, errorMessage: "fail!" });
        expect(react_2.screen.getByText("Error fetching billing data")).toBeInTheDocument();
        expect(react_2.screen.getByText("fail!")).toBeInTheDocument();
    });
    it("shows empty state when no data", function () {
        setup({ data: [] });
        expect(react_2.screen.getByText(/No billing history found/i)).toBeInTheDocument();
    });
    it("renders table with billing data", function () {
        var _a;
        var data = setup().data;
        expect(react_2.screen.getByText("History")).toBeInTheDocument();
        expect(react_2.screen.getByText("Date")).toBeInTheDocument();
        expect(react_2.screen.getByText("Amount")).toBeInTheDocument();
        expect(react_2.screen.getByText("Account source")).toBeInTheDocument();
        expect(react_2.screen.getByText("Status")).toBeInTheDocument();
        expect(react_2.screen.getByText("Receipt")).toBeInTheDocument();
        expect(react_2.screen.getByText(new Date(data[0].created * 1000).toLocaleDateString())).toBeInTheDocument();
        expect(react_2.screen.getByText((data[0].amount / 100).toFixed(2))).toBeInTheDocument();
        expect(react_2.screen.getByText(new RegExp(((_a = data[0].paymentMethod.card) === null || _a === void 0 ? void 0 : _a.last4) || ""))).toBeInTheDocument();
        expect(react_2.screen.getByText(/Succeeded|Pending|Failed/i)).toBeInTheDocument();
    });
    it("calls onPaginationChange when changing page size", function () {
        var onPaginationChange = jest.fn();
        setup({ onPaginationChange: onPaginationChange });
        react_2.fireEvent.change(react_2.screen.getByRole("combobox"), { target: { value: "20" } });
        expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 20 });
    });
    it("calls onPaginationChange when clicking next/prev", function () {
        var onPaginationChange = jest.fn();
        setup({ onPaginationChange: onPaginationChange, hasMore: true, hasPrevious: true, pagination: { pageIndex: 1, pageSize: 10 } });
        react_2.fireEvent.click(react_2.screen.getByText("Previous"));
        expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 10 });
        react_2.fireEvent.click(react_2.screen.getByText("Next"));
        expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 2, pageSize: 10 });
    });
    it("disables export button when no data", function () {
        setup({ data: [] });
        expect(react_2.screen.getByText(/Export as CSV/i)).toBeDisabled();
    });
    it("enables export button when data exists", function () {
        setup();
        expect(react_2.screen.getByText(/Export as CSV/i)).not.toBeDisabled();
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
                from: new Date("2020-01-01"),
                to: new Date()
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
    it("calls onExport when export button clicked", function () {
        var onExport = jest.fn();
        setup({ onExport: onExport });
        react_2.fireEvent.click(react_2.screen.getByText(/Export as CSV/i));
        expect(onExport).toHaveBeenCalled();
    });
    function setup(props) {
        var _a, _b, _c, _d, _e, _f;
        if (props === void 0) { props = {}; }
        var defaultData = (0, payment_1.createMockItems)(payment_1.createMockTransaction, 1).map(function (t) {
            return (0, jest_mock_extended_1.mock)(__assign(__assign({}, t), { paymentMethod: t.payment_method, receiptUrl: "https://example.com/receipt" }));
        });
        var defaultComponents = {
            FormattedNumber: function (_a) {
                var value = _a.value;
                return <span>{value.toFixed(2)}</span>;
            },
            PaginationSizeSelector: function (_a) {
                var pageSize = _a.pageSize, setPageSize = _a.setPageSize;
                return (<select value={pageSize} onChange={function (e) { return setPageSize === null || setPageSize === void 0 ? void 0 : setPageSize(parseInt(e.target.value, 10)); }} role="combobox">
          {[10, 20, 50].map(function (size) { return (<option key={size} value={size}>
              {size}
            </option>); })}
        </select>);
            },
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
        var defaultProps = __assign({ data: (_a = props.data) !== null && _a !== void 0 ? _a : defaultData, hasMore: false, hasPrevious: false, isFetching: false, isError: false, errorMessage: "", onExport: (_b = props.onExport) !== null && _b !== void 0 ? _b : jest.fn(), onPaginationChange: (_c = props.onPaginationChange) !== null && _c !== void 0 ? _c : jest.fn(), pagination: (_d = props.pagination) !== null && _d !== void 0 ? _d : { pageIndex: 0, pageSize: 10 }, totalCount: 1, dateRange: { from: new Date(), to: new Date() }, onDateRangeChange: (_e = props.onDateRangeChange) !== null && _e !== void 0 ? _e : jest.fn(), components: (_f = props.components) !== null && _f !== void 0 ? _f : defaultComponents }, props);
        (0, react_2.render)(<components_1.TooltipProvider>
        <BillingView_1.BillingView {...defaultProps}/>
      </components_1.TooltipProvider>);
        return defaultProps;
    }
});
