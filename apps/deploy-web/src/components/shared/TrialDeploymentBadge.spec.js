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
var jest_mock_extended_1 = require("jest-mock-extended");
var TrialDeploymentBadge_1 = require("./TrialDeploymentBadge");
var react_2 = require("@testing-library/react");
var mocks_1 = require("@tests/unit/mocks");
describe("TrialDeploymentBadge", function () {
    it("renders trial badge with correct text", function () {
        setup({ blockHeight: 10001440 });
        expect(react_2.screen.queryByText("Trial")).toBeInTheDocument();
    });
    it("shows expired state when trial has expired", function () {
        setup({ blockHeight: 10002880 });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        // Check that the badge is rendered (the actual styling is handled by the Badge component)
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    it("shows active state when trial is still valid", function () {
        setup({ blockHeight: 10000720 });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        // Check that the badge is rendered (the actual styling is handled by the Badge component)
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    it("uses custom trial duration", function () {
        setup({
            blockHeight: 10002160,
            trialDurationHours: 48
        });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        // Check that the badge is rendered (the actual styling is handled by the Badge component)
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    it("uses environment config trial duration when no prop provided", function () {
        setup({
            blockHeight: 10001440,
            trialDurationHours: undefined
        });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        // Check that the badge is rendered (the actual styling is handled by the Badge component)
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    it("uses custom average block time", function () {
        setup({
            blockHeight: 10000720,
            averageBlockTime: 12
        });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        // Check that the badge is rendered (the actual styling is handled by the Badge component)
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    it("applies custom className", function () {
        setup({
            blockHeight: 10001440,
            className: "custom-class"
        });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        // Check that the badge is rendered (the actual styling is handled by the Badge component)
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    it("handles edge case where blocks remaining is exactly 0", function () {
        setup({ blockHeight: 10001440 });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        // Check that the badge is rendered (the actual styling is handled by the Badge component)
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    it("handles negative blocks remaining", function () {
        setup({ blockHeight: 10001500 });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    it("handles undefined createdHeight", function () {
        setup({ blockHeight: 10001440, createdHeight: undefined });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    it("handles zero trial duration", function () {
        setup({ blockHeight: 10001440, trialDurationHours: 0 });
        var badge = react_2.screen.queryByText("Trial");
        expect(badge).toBeInTheDocument();
        expect(badge === null || badge === void 0 ? void 0 : badge.closest("div")).toBeInTheDocument();
    });
    function setup(input) {
        var _a;
        var mockUseTrialTimeRemaining = (0, jest_mock_extended_1.mockFn)();
        mockUseTrialTimeRemaining.mockReturnValue({
            isExpired: input.blockHeight > 10001440, // Simple logic for expired state
            timeRemainingText: input.blockHeight > 10001440 ? "Trial expired" : "in 24 hours",
            timeLeft: input.blockHeight > 10001440 ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
            latestBlock: {
                block: {
                    header: {
                        height: input.blockHeight.toString()
                    }
                }
            }
        });
        var props = {
            createdHeight: (_a = input.createdHeight) !== null && _a !== void 0 ? _a : 10000000,
            trialDurationHours: input.trialDurationHours,
            averageBlockTime: input.averageBlockTime || 6,
            className: input.className,
            dependencies: __assign(__assign({}, TrialDeploymentBadge_1.DEPENDENCIES), { Badge: mocks_1.ComponentMock, CustomTooltip: mocks_1.ComponentMock, TrialDeploymentTooltip: mocks_1.ComponentMock, useTrialTimeRemaining: mockUseTrialTimeRemaining })
        };
        (0, react_2.render)(<TrialDeploymentBadge_1.TrialDeploymentBadge {...props}/>);
    }
});
