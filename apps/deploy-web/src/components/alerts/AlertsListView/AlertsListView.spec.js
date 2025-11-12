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
var context_1 = require("@akashnetwork/ui/context");
var lodash_1 = require("lodash");
var AlertsListView_1 = require("./AlertsListView");
var react_2 = require("@testing-library/react");
var alert_1 = require("@tests/seeders/alert");
describe(AlertsListView_1.AlertsListView.name, function () {
    it("renders loading spinner when isLoading is true", function () {
        setup({ isLoading: true });
        expect(react_2.screen.getByRole("status")).toBeInTheDocument();
    });
    it("renders error message when isError is true", function () {
        setup({ isError: true });
        expect(react_2.screen.getByText("Error loading alerts")).toBeInTheDocument();
    });
    it("renders empty state message when no data is provided", function () {
        setup({ data: [] });
        expect(react_2.screen.getByText("No alerts found")).toBeInTheDocument();
    });
    it("renders table with enabled alert with params", function () {
        var mockAlert = (0, alert_1.buildAlert)({
            type: "DEPLOYMENT_BALANCE",
            enabled: true,
            params: { owner: "owner", dseq: "12345" }
        });
        setup({ data: [mockAlert] });
        expect(react_2.screen.getByText(mockAlert.deploymentName)).toBeInTheDocument();
        expect(react_2.screen.getByText("Escrow Threshold")).toBeInTheDocument();
        expect(react_2.screen.getByText((0, lodash_1.capitalize)(mockAlert.status))).toBeInTheDocument();
        var checkbox = react_2.screen.getByRole("checkbox");
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).toBeChecked();
        expect(react_2.screen.getByText("12345")).toBeInTheDocument();
    });
    it("renders table with disabled alert without params", function () {
        var mockAlert = (0, alert_1.buildAlert)({
            type: "CHAIN_MESSAGE",
            enabled: false,
            params: undefined
        });
        setup({ data: [mockAlert] });
        expect(react_2.screen.getByText(mockAlert.deploymentName)).toBeInTheDocument();
        expect(react_2.screen.getByText((0, lodash_1.startCase)(mockAlert.type.toLowerCase()))).toBeInTheDocument();
        expect(react_2.screen.getByText((0, lodash_1.capitalize)(mockAlert.status))).toBeInTheDocument();
        var checkbox = react_2.screen.getByRole("checkbox");
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).not.toBeChecked();
        expect(react_2.screen.getByText("N/A")).toBeInTheDocument();
    });
    it("does not render pagination when total is not greater than minimum page size", function () {
        setup();
        expect(react_2.screen.queryByRole("navigation")).not.toBeInTheDocument();
    });
    it("renders pagination when total is greater than minimum page size", function () {
        var pagination = {
            page: 1,
            limit: 10,
            total: 11,
            totalPages: 2
        };
        var mockData = Array.from({ length: 11 }, alert_1.buildAlert);
        setup({ data: mockData, pagination: pagination });
        expect(react_2.screen.getByRole("navigation")).toBeInTheDocument();
    });
    function setup(props) {
        if (props === void 0) { props = {}; }
        var defaultProps = __assign({ pagination: {
                page: 1,
                limit: 10,
                total: 10,
                totalPages: 1
            }, data: Array.from({ length: 10 }, alert_1.buildAlert), isLoading: false, onToggle: jest.fn(), loadingIds: new Set(), onPaginationChange: jest.fn(), isError: false }, props);
        var mockUseFlag = jest.fn(function (flag) {
            if (flag === "notifications_general_alerts_update") {
                return true;
            }
            return false;
        });
        var dependencies = {
            useFlag: function () { return mockUseFlag; }
        };
        (0, react_2.render)(<context_1.PopupProvider>
        <components_1.TooltipProvider>
          <AlertsListView_1.AlertsListView {...defaultProps} dependencies={dependencies}/>
        </components_1.TooltipProvider>
      </context_1.PopupProvider>);
        return defaultProps;
    }
});
