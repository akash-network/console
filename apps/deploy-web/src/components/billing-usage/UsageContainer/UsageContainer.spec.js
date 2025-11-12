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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("@testing-library/jest-dom");
var react_1 = require("react");
var UsageContainer_1 = require("@src/components/billing-usage/UsageContainer/UsageContainer");
var react_2 = require("@testing-library/react");
var usage_1 = require("@tests/seeders/usage");
var container_testing_child_capturer_1 = require("@tests/unit/container-testing-child-capturer");
describe(UsageContainer_1.UsageContainer.name, function () {
    it("renders usage history and stats with data", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, usageHistoryData, usageHistoryStatsData, child;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), usageHistoryData = _a.usageHistoryData, usageHistoryStatsData = _a.usageHistoryStatsData, child = _a.child;
                    expect(child.usageHistoryData).toEqual(usageHistoryData);
                    expect(child.usageHistoryStatsData).toEqual(usageHistoryStatsData);
                    return [2 /*return*/];
            }
        });
    }); });
    it("passes through loading flags correctly", function () { return __awaiter(void 0, void 0, void 0, function () {
        var child;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({
                        isFetchingUsageHistory: true,
                        isFetchingUsageHistoryStats: true
                    })];
                case 1:
                    child = (_a.sent()).child;
                    expect(child.isFetchingUsageHistory).toBe(true);
                    expect(child.isFetchingUsageHistoryStats).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    it("passes through error flags correctly", function () { return __awaiter(void 0, void 0, void 0, function () {
        var child;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({
                        isUsageHistoryError: true,
                        isUsageHistoryStatsError: true
                    })];
                case 1:
                    child = (_a.sent()).child;
                    expect(child.isUsageHistoryError).toBe(true);
                    expect(child.isUsageHistoryStatsError).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    it("uses default values when data is empty", function () { return __awaiter(void 0, void 0, void 0, function () {
        var child;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({
                        usageHistoryData: [],
                        usageHistoryStatsData: {
                            totalSpent: 0,
                            averageSpentPerDay: 0,
                            totalDeployments: 0,
                            averageDeploymentsPerDay: 0
                        }
                    })];
                case 1:
                    child = (_a.sent()).child;
                    expect(child.usageHistoryData).toEqual([]);
                    expect(child.usageHistoryStatsData).toEqual({
                        totalSpent: 0,
                        averageSpentPerDay: 0,
                        totalDeployments: 0,
                        averageDeploymentsPerDay: 0
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls onDateRangeChange", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, onDateRangeChange, newRange;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), child = _a.child, onDateRangeChange = _a.onDateRangeChange;
                    newRange = { from: new Date(2024, 0, 1), to: new Date(2024, 0, 2) };
                    child.onDateRangeChange(newRange);
                    expect(onDateRangeChange).toHaveBeenCalledWith(newRange);
                    return [2 /*return*/];
            }
        });
    }); });
    function setup() {
        return __awaiter(this, arguments, void 0, function (overrides) {
            var usageHistoryData, usageHistoryStatsData, isFetchingUsageHistory, isUsageHistoryError, isFetchingUsageHistoryStats, isUsageHistoryStatsError, onDateRangeChange, mockedUseWallet, mockedUseUsage, mockedUseUsageStats, dependencies, childCapturer, child;
            var _a, _b, _c, _d, _e, _f;
            if (overrides === void 0) { overrides = {}; }
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        usageHistoryData = (_a = overrides.usageHistoryData) !== null && _a !== void 0 ? _a : (0, usage_1.buildUsageHistory)();
                        usageHistoryStatsData = (_b = overrides.usageHistoryStatsData) !== null && _b !== void 0 ? _b : (0, usage_1.buildUsageHistoryStats)();
                        isFetchingUsageHistory = (_c = overrides.isFetchingUsageHistory) !== null && _c !== void 0 ? _c : false;
                        isUsageHistoryError = (_d = overrides.isUsageHistoryError) !== null && _d !== void 0 ? _d : false;
                        isFetchingUsageHistoryStats = (_e = overrides.isFetchingUsageHistoryStats) !== null && _e !== void 0 ? _e : false;
                        isUsageHistoryStatsError = (_f = overrides.isUsageHistoryStatsError) !== null && _f !== void 0 ? _f : false;
                        onDateRangeChange = jest.fn();
                        mockedUseWallet = jest.fn(function () { return ({ address: "0xABCDEF" }); });
                        mockedUseUsage = jest.fn(function () { return ({
                            data: usageHistoryData,
                            isError: isUsageHistoryError,
                            isFetching: isFetchingUsageHistory
                        }); });
                        mockedUseUsageStats = jest.fn(function () { return ({
                            data: usageHistoryStatsData,
                            isError: isUsageHistoryStatsError,
                            isFetching: isFetchingUsageHistoryStats
                        }); });
                        dependencies = {
                            useWallet: mockedUseWallet,
                            useUsage: mockedUseUsage,
                            useUsageStats: mockedUseUsageStats
                        };
                        childCapturer = (0, container_testing_child_capturer_1.createContainerTestingChildCapturer)();
                        (0, react_2.render)(<UsageContainer_1.UsageContainer dependencies={dependencies}>
        {function (props) {
                                return childCapturer.renderChild(__assign(__assign({}, props), { onDateRangeChange: function (range) {
                                        onDateRangeChange(range);
                                        props.onDateRangeChange(range);
                                    } }));
                            }}
      </UsageContainer_1.UsageContainer>);
                        return [4 /*yield*/, childCapturer.awaitChild(function () { return true; })];
                    case 1:
                        child = _g.sent();
                        return [2 /*return*/, { usageHistoryData: usageHistoryData, usageHistoryStatsData: usageHistoryStatsData, onDateRangeChange: onDateRangeChange, child: child }];
                }
            });
        });
    }
});
