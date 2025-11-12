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
var react_1 = require("react");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var TrialDeploymentTooltip_1 = require("./TrialDeploymentTooltip");
var react_2 = require("@testing-library/react");
var mocks_1 = require("@tests/unit/mocks");
describe("TrialDeploymentTooltip", function () {
    it("renders trial deployment info when no created height", function () {
        setup({ createdHeight: undefined });
        expect(react_2.screen.getByText("Trial Deployment")).toBeInTheDocument();
        expect(react_2.screen.getByText(/Trial deployments are automatically closed after/)).toBeInTheDocument();
        expect(react_2.screen.getByText("Add Funds")).toBeInTheDocument();
    });
    it("displays correct trial duration in hours when no created height", function () {
        setup({ createdHeight: undefined, trialDuration: 24 });
        expect(react_2.screen.getByText(function (content, element) {
            return (element === null || element === void 0 ? void 0 : element.textContent) === "Trial deployments are automatically closed after 24 hours.";
        })).toBeInTheDocument();
    });
    it("renders expired state message when trial has expired", function () {
        setup({ createdHeight: 10000000, isExpired: true });
        expect(react_2.screen.getByText("This trial deployment has expired and will be closed automatically.")).toBeInTheDocument();
        expect(react_2.screen.getByText("Add Funds")).toBeInTheDocument();
    });
    it("renders active trial state with time remaining", function () {
        setup({ createdHeight: 10000000, timeRemainingText: "2 hours 30 minutes" });
        expect(react_2.screen.getByText("Trial Deployment")).toBeInTheDocument();
        expect(react_2.screen.getByText("Time remaining:")).toBeInTheDocument();
        expect(react_2.screen.getByText("2 hours 30 minutes")).toBeInTheDocument();
        expect(react_2.screen.getByText("Add funds to activate your account.")).toBeInTheDocument();
        expect(react_2.screen.getByText("Add Funds")).toBeInTheDocument();
    });
    it("displays correct trial duration in active state", function () {
        setup({ createdHeight: 10000000, trialDuration: 48 });
        expect(react_2.screen.getByText(function (content, element) {
            return (element === null || element === void 0 ? void 0 : element.textContent) === "Trial deployments are automatically closed after 48 hours.";
        })).toBeInTheDocument();
    });
    it("renders Add Funds button", function () {
        setup({ createdHeight: 10000000 });
        var addFundsButton = react_2.screen.getByText("Add Funds");
        expect(addFundsButton).toBeInTheDocument();
    });
    it("renders HandCard icon in Add Funds button", function () {
        var _a;
        setup({ createdHeight: 10000000 });
        var addFundsButton = react_2.screen.getByText("Add Funds");
        expect(addFundsButton).toBeInTheDocument();
        var svgIcon = (_a = addFundsButton.closest("div")) === null || _a === void 0 ? void 0 : _a.querySelector("svg");
        expect(svgIcon).toBeInTheDocument();
    });
    it("handles null time remaining text gracefully", function () {
        setup({ createdHeight: 10000000, timeRemainingText: null });
        expect(react_2.screen.getByText("Trial Deployment")).toBeInTheDocument();
        expect(react_2.screen.getByText("Time remaining:")).toBeInTheDocument();
        expect(react_2.screen.queryByText("null")).not.toBeInTheDocument();
    });
    it("handles empty time remaining text gracefully", function () {
        var _a;
        setup({ createdHeight: 10000000, timeRemainingText: "" });
        expect(react_2.screen.getByText("Trial Deployment")).toBeInTheDocument();
        expect(react_2.screen.getByText("Time remaining:")).toBeInTheDocument();
        var timeRemainingSpan = (_a = react_2.screen.getByText("Time remaining:").closest("p")) === null || _a === void 0 ? void 0 : _a.querySelector("span");
        expect(timeRemainingSpan).toHaveClass("font-medium", "text-primary");
        expect(timeRemainingSpan === null || timeRemainingSpan === void 0 ? void 0 : timeRemainingSpan.textContent).toBe("");
    });
    it("handles zero trial duration", function () {
        setup({ createdHeight: 10000000, trialDuration: 0 });
        expect(react_2.screen.getByText("Trial Deployment")).toBeInTheDocument();
        expect(react_2.screen.getByText("Time remaining:")).toBeInTheDocument();
        expect(react_2.screen.getByText("2 hours 30 minutes")).toBeInTheDocument();
        expect(react_2.screen.getByText("0")).toBeInTheDocument();
    });
    it("handles very large trial duration", function () {
        setup({ createdHeight: 10000000, trialDuration: 999999 });
        expect(react_2.screen.getByText("Trial Deployment")).toBeInTheDocument();
        expect(react_2.screen.getByText("Time remaining:")).toBeInTheDocument();
        expect(react_2.screen.getByText("2 hours 30 minutes")).toBeInTheDocument();
        expect(react_2.screen.getByText("999999")).toBeInTheDocument();
    });
    function setup(input) {
        var _a, _b, _c, _d;
        var props = {
            createdHeight: input.createdHeight,
            isExpired: (_a = input.isExpired) !== null && _a !== void 0 ? _a : false,
            timeRemainingText: (_b = input.timeRemainingText) !== null && _b !== void 0 ? _b : "2 hours 30 minutes",
            trialDuration: (_c = input.trialDuration) !== null && _c !== void 0 ? _c : 24,
            dependencies: (_d = input.dependencies) !== null && _d !== void 0 ? _d : __assign(__assign({}, TrialDeploymentTooltip_1.DEPENDENCIES), { AddFundsLink: mocks_1.ComponentMock })
        };
        return (0, react_2.render)(<ServicesProvider_1.ServicesProvider>
        <TrialDeploymentTooltip_1.TrialDeploymentTooltip {...props}/>
      </ServicesProvider_1.ServicesProvider>);
    }
});
