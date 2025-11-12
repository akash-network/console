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
var jest_mock_extended_1 = require("jest-mock-extended");
var BillingContainer_1 = require("./BillingContainer");
var react_2 = require("@testing-library/react");
var payment_1 = require("@tests/seeders/payment");
var container_testing_child_capturer_1 = require("@tests/unit/container-testing-child-capturer");
describe(BillingContainer_1.BillingContainer.name, function () {
    it("renders payment transactions data", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, data, child;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), data = _a.data, child = _a.child;
                    expect(child.data).toEqual(data === null || data === void 0 ? void 0 : data.transactions);
                    expect(child.totalCount).toBe(data === null || data === void 0 ? void 0 : data.totalCount);
                    expect(child.hasMore).toBe(data === null || data === void 0 ? void 0 : data.hasMore);
                    expect(child.hasPrevious).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("passes through loading and error flags", function () { return __awaiter(void 0, void 0, void 0, function () {
        var child;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({ isFetching: true, isError: true })];
                case 1:
                    child = (_a.sent()).child;
                    expect(child.isFetching).toBe(true);
                    expect(child.isError).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); });
    it("passes error object if queryError is axios error", function () { return __awaiter(void 0, void 0, void 0, function () {
        var axiosError, child;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    axiosError = (0, jest_mock_extended_1.mock)({
                        isAxiosError: true,
                        response: { data: { message: "fail" } }
                    });
                    return [4 /*yield*/, setup({ queryError: axiosError })];
                case 1:
                    child = (_a.sent()).child;
                    expect(child.errorMessage).toBe("fail");
                    return [2 /*return*/];
            }
        });
    }); });
    it("uses default values when data is empty", function () { return __awaiter(void 0, void 0, void 0, function () {
        var child;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, setup({ data: undefined })];
                case 1:
                    child = (_a.sent()).child;
                    expect(child.data).toEqual([]);
                    expect(child.totalCount).toBe(0);
                    expect(child.hasMore).toBe(false);
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls onPaginationChange", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, onPaginationChange, newPagination;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), child = _a.child, onPaginationChange = _a.onPaginationChange;
                    newPagination = { pageIndex: 1, pageSize: 10 };
                    child.onPaginationChange(newPagination);
                    expect(onPaginationChange).toHaveBeenCalledWith(newPagination);
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
    it("calls onExport", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, onExport;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), child = _a.child, onExport = _a.onExport;
                    child.onExport();
                    expect(onExport).toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    function setup() {
        return __awaiter(this, arguments, void 0, function (overrides) {
            var useDefaultData, data, isFetching, isError, queryError, onPaginationChange, onDateRangeChange, onExport, mockedUsePaymentTransactionsQuery, dependencies, childCapturer, child;
            var _a, _b, _c;
            if (overrides === void 0) { overrides = {}; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        useDefaultData = !Object.prototype.hasOwnProperty.call(overrides, "data");
                        data = useDefaultData
                            ? {
                                transactions: [(0, payment_1.createMockTransaction)()],
                                hasMore: true,
                                nextPage: "next_cursor",
                                totalCount: 1
                            }
                            : overrides.data;
                        isFetching = (_a = overrides.isFetching) !== null && _a !== void 0 ? _a : false;
                        isError = (_b = overrides.isError) !== null && _b !== void 0 ? _b : false;
                        queryError = (_c = overrides.queryError) !== null && _c !== void 0 ? _c : null;
                        onPaginationChange = jest.fn();
                        onDateRangeChange = jest.fn();
                        onExport = jest.fn();
                        mockedUsePaymentTransactionsQuery = jest.fn(function () { return ({
                            data: data,
                            isFetching: isFetching,
                            isError: isError,
                            error: queryError
                        }); });
                        dependencies = {
                            usePaymentTransactionsQuery: mockedUsePaymentTransactionsQuery
                        };
                        childCapturer = (0, container_testing_child_capturer_1.createContainerTestingChildCapturer)();
                        (0, react_2.render)(<BillingContainer_1.BillingContainer dependencies={dependencies}>
        {function (props) {
                                return childCapturer.renderChild(__assign(__assign({}, props), { onPaginationChange: function (state) {
                                        onPaginationChange(state);
                                        props.onPaginationChange(state);
                                    }, onDateRangeChange: function (range) {
                                        onDateRangeChange(range);
                                        props.onDateRangeChange(range);
                                    }, onExport: function () {
                                        onExport();
                                        props.onExport();
                                    } }));
                            }}
      </BillingContainer_1.BillingContainer>);
                        return [4 /*yield*/, childCapturer.awaitChild(function () { return true; })];
                    case 1:
                        child = _d.sent();
                        return [2 /*return*/, { data: data, child: child, onPaginationChange: onPaginationChange, onDateRangeChange: onDateRangeChange, onExport: onExport }];
                }
            });
        });
    }
});
