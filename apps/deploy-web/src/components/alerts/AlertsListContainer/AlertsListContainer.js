"use strict";
"use client";
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
exports.AlertsListContainer = void 0;
var react_1 = require("react");
var react_2 = require("react");
var react_3 = require("react");
var react_query_1 = require("@tanstack/react-query");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useNotificator_1 = require("@src/hooks/useNotificator");
var queries_1 = require("@src/queries");
var AlertsListContainer = function (_a) {
    var _b, _c;
    var children = _a.children;
    var _d = (0, react_3.useState)(1), page = _d[0], setPage = _d[1];
    var _e = (0, react_3.useState)(10), limit = _e[0], setLimit = _e[1];
    var _f = (0, react_3.useState)(new Set()), loadingIds = _f[0], setLoadingIds = _f[1];
    var notificationsApi = (0, ServicesProvider_1.useServices)().notificationsApi;
    var queryClient = (0, react_query_1.useQueryClient)();
    var _g = notificationsApi.v1.getAlerts.useQuery({
        query: {
            page: page,
            limit: limit
        }
    }), data = _g.data, isError = _g.isError, isLoading = _g.isLoading, refetch = _g.refetch;
    var getDeploymentName = (0, LocalNoteProvider_1.useLocalNotes)().getDeploymentName;
    var notificator = (0, useNotificator_1.useNotificator)();
    var deleteMutation = notificationsApi.v1.deleteAlert.useMutation();
    var patchMutation = notificationsApi.v1.patchAlert.useMutation();
    var address = (0, WalletProvider_1.useWallet)().address;
    var remove = (0, react_3.useCallback)(function (id) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, 3, 4]);
                    setLoadingIds(function (prev) { return new Set(prev).add(id); });
                    return [4 /*yield*/, deleteMutation.mutateAsync({
                            path: {
                                id: id
                            }
                        })];
                case 1:
                    _a.sent();
                    notificator.success("Alert removed", { dataTestId: "alert-remove-success-notification" });
                    if ((data === null || data === void 0 ? void 0 : data.data.length) === 1 && page > 1) {
                        setPage(page - 1);
                    }
                    else {
                        refetch();
                    }
                    return [3 /*break*/, 4];
                case 2:
                    error_1 = _a.sent();
                    notificator.error("Failed to remove alert", {
                        dataTestId: "alert-remove-error-notification"
                    });
                    return [3 /*break*/, 4];
                case 3:
                    setLoadingIds(function (prev) {
                        var nextSet = new Set(prev);
                        nextSet.delete(id);
                        return nextSet;
                    });
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [deleteMutation, data === null || data === void 0 ? void 0 : data.data.length, page, refetch, notificator]);
    var toggle = (0, react_3.useCallback)(function (id, enabled, dseq) { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, 4, 5]);
                    setLoadingIds(function (prev) { return new Set(prev).add(id); });
                    return [4 /*yield*/, patchMutation.mutateAsync({
                            path: { id: id },
                            body: {
                                data: {
                                    enabled: enabled
                                }
                            }
                        })];
                case 1:
                    _a.sent();
                    notificator.success("Alert ".concat(enabled ? "enabled" : "disabled"));
                    refetch();
                    return [4 /*yield*/, queryClient.invalidateQueries({
                            queryKey: queries_1.QueryKeys.getDeploymentDetailKey(address, dseq)
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _a.sent();
                    notificator.error("Failed to update alert");
                    return [3 /*break*/, 5];
                case 4:
                    setLoadingIds(function (prev) {
                        var nextSet = new Set(prev);
                        nextSet.delete(id);
                        return nextSet;
                    });
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [patchMutation, notificator, refetch, queryClient, address]);
    var changePage = (0, react_3.useCallback)(function (_a) {
        var page = _a.page, limit = _a.limit;
        setPage(page);
        setLimit(limit);
    }, []);
    var dataWithNames = (0, react_1.useMemo)(function () {
        return data === null || data === void 0 ? void 0 : data.data.map(function (item) {
            var _a;
            return (__assign(__assign({}, item), { deploymentName: (((_a = item.params) === null || _a === void 0 ? void 0 : _a.dseq) && getDeploymentName(item.params.dseq)) || "NA" }));
        });
    }, [data === null || data === void 0 ? void 0 : data.data, getDeploymentName]);
    return (<>
      {children({
            pagination: {
                page: page,
                limit: limit,
                total: (_b = data === null || data === void 0 ? void 0 : data.pagination.total) !== null && _b !== void 0 ? _b : 0,
                totalPages: (_c = data === null || data === void 0 ? void 0 : data.pagination.totalPages) !== null && _c !== void 0 ? _c : 0
            },
            data: dataWithNames || [],
            onPaginationChange: changePage,
            onToggle: toggle,
            loadingIds: loadingIds,
            onRemove: remove,
            isLoading: isLoading,
            isError: isError
        })}
    </>);
};
exports.AlertsListContainer = AlertsListContainer;
