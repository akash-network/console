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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingContainer = void 0;
var react_1 = require("react");
var hooks_1 = require("@akashnetwork/ui/hooks");
var axios_1 = require("axios");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var queries_1 = require("@src/queries");
var dateUtils_1 = require("@src/utils/dateUtils");
var domUtils_1 = require("@src/utils/domUtils");
var DEPENDENCIES = {
    usePaymentTransactionsQuery: queries_1.usePaymentTransactionsQuery
};
var BillingContainer = function (_a) {
    var children = _a.children, _b = _a.dependencies, D = _b === void 0 ? DEPENDENCIES : _b;
    var toast = (0, hooks_1.useToast)().toast;
    var stripe = (0, ServicesProvider_1.useServices)().stripe;
    var _c = react_1.default.useState(function () { return (0, dateUtils_1.createDateRange)(); }), dateRange = _c[0], setDateRange = _c[1];
    var _d = (0, react_1.useState)({ pageIndex: 0, pageSize: 10 }), pagination = _d[0], setPagination = _d[1];
    var _e = (0, react_1.useState)({}), currentCursors = _e[0], setCurrentCursors = _e[1];
    var _f = (0, react_1.useState)([{ pageIndex: 0 }]), cursorHistory = _f[0], setCursorHistory = _f[1];
    var _g = react_1.default.useState(""), errorMessage = _g[0], setErrorMessage = _g[1];
    var startDate = dateRange.from, endDate = dateRange.to;
    var _h = D.usePaymentTransactionsQuery({
        limit: pagination.pageSize,
        startingAfter: currentCursors.startingAfter,
        endingBefore: currentCursors.endingBefore,
        startDate: startDate,
        endDate: endDate
    }), data = _h.data, isFetching = _h.isFetching, isError = _h.isError, queryError = _h.error;
    react_1.default.useEffect(function () {
        var _a;
        if (axios_1.default.isAxiosError(queryError)) {
            setErrorMessage(((_a = queryError.response) === null || _a === void 0 ? void 0 : _a.data.message) || "An error occurred while fetching payment transactions.");
        }
    }, [queryError]);
    var handlePaginationChange = function (state) {
        var isForward = state.pageIndex > pagination.pageIndex;
        var isBackward = state.pageIndex < pagination.pageIndex;
        if (isForward && (data === null || data === void 0 ? void 0 : data.nextPage)) {
            var newCursors = {
                startingAfter: data.nextPage,
                endingBefore: undefined
            };
            setCurrentCursors(newCursors);
            setCursorHistory(function (prev) { return __spreadArray(__spreadArray([], prev, true), [
                {
                    startingAfter: data.nextPage,
                    pageIndex: state.pageIndex
                }
            ], false); });
        }
        else if (isBackward) {
            var targetHistoryItem = cursorHistory.find(function (item) { return item.pageIndex === state.pageIndex; });
            if (targetHistoryItem) {
                setCurrentCursors({
                    startingAfter: targetHistoryItem.startingAfter,
                    endingBefore: targetHistoryItem.endingBefore
                });
                setCursorHistory(function (prev) { return prev.filter(function (item) { return item.pageIndex <= state.pageIndex; }); });
            }
            else if (state.pageIndex === 0) {
                setCurrentCursors({});
                setCursorHistory([{ pageIndex: 0 }]);
            }
        }
        else if (state.pageSize !== pagination.pageSize) {
            setCurrentCursors({});
            setCursorHistory([{ pageIndex: 0 }]);
            setPagination(function (prev) { return (__assign(__assign({}, prev), { pageIndex: 0, pageSize: state.pageSize })); });
            return;
        }
        setPagination(state);
    };
    var changeDateRange = function (range) {
        setDateRange((0, dateUtils_1.createDateRange)(range));
        setCurrentCursors({});
        setCursorHistory([{ pageIndex: 0 }]);
        setPagination(function (prev) { return (__assign(__assign({}, prev), { pageIndex: 0 })); });
        setErrorMessage("");
    };
    var exportCsv = function () { return __awaiter(void 0, void 0, void 0, function () {
        var timezone, csv, dateFrom, dateTo, filename, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!startDate || !endDate) {
                        return [2 /*return*/];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    return [4 /*yield*/, stripe.exportTransactionsCsv({
                            startDate: startDate,
                            endDate: endDate,
                            timezone: timezone
                        })];
                case 2:
                    csv = _b.sent();
                    dateFrom = startDate.toLocaleDateString("en-CA", { timeZone: timezone });
                    dateTo = endDate.toLocaleDateString("en-CA", { timeZone: timezone });
                    filename = "transactions_".concat(dateFrom, "_").concat(dateTo);
                    (0, domUtils_1.downloadCsv)(csv, filename);
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _b.sent();
                    toast({
                        title: "Failed to export transactions",
                        description: axios_1.default.isAxiosError(error_1) ? ((_a = error_1.response) === null || _a === void 0 ? void 0 : _a.data.message) || "An error occurred while exporting transactions." : error_1.message,
                        variant: "destructive"
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<>
      {children({
            data: (data === null || data === void 0 ? void 0 : data.transactions) || [],
            hasMore: (data === null || data === void 0 ? void 0 : data.hasMore) || false,
            hasPrevious: pagination.pageIndex > 0,
            onExport: exportCsv,
            onPaginationChange: handlePaginationChange,
            totalCount: (data === null || data === void 0 ? void 0 : data.totalCount) || 0,
            dateRange: dateRange,
            onDateRangeChange: changeDateRange,
            pagination: pagination,
            isFetching: isFetching,
            isError: isError,
            errorMessage: errorMessage
        })}
    </>);
};
exports.BillingContainer = BillingContainer;
