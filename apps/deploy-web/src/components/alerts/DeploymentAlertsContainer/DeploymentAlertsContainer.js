"use strict";
"use client";
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
exports.DeploymentAlertsContainer = void 0;
var react_1 = require("react");
var react_2 = require("react");
var react_query_1 = require("@tanstack/react-query");
var lodash_1 = require("lodash");
var PricingProvider_1 = require("@src/context/PricingProvider");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useNotificator_1 = require("@src/hooks/useNotificator");
var useWhen_1 = require("@src/hooks/useWhen");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var DEPENDENCIES = {
    usePricing: PricingProvider_1.usePricing
};
var DeploymentAlertsContainer = function (_a) {
    var children = _a.children, deployment = _a.deployment, _b = _a.dependencies, d = _b === void 0 ? DEPENDENCIES : _b;
    var notificationsApi = (0, ServicesProvider_1.useServices)().notificationsApi;
    var queryClient = (0, react_query_1.useQueryClient)();
    var notificator = (0, useNotificator_1.useNotificator)();
    var _c = d.usePricing(), usdToAkt = _c.usdToAkt, getPriceForDenom = _c.getPriceForDenom;
    var _d = notificationsApi.v1.getDeploymentAlerts.useQuery({
        path: {
            dseq: deployment.dseq
        }
    }), data = _d.data, isLoading = _d.isLoading, isFetched = _d.isFetched, isError = _d.isError;
    var mutation = notificationsApi.v1.upsertDeploymentAlert.useMutation();
    var convert = (0, react_2.useCallback)(function (value) {
        if (deployment.denom !== "uakt") {
            return (0, mathHelpers_1.denomToUdenom)(value);
        }
        var akt = usdToAkt(value);
        if (akt === null) {
            throw new Error("Could not convert balance to AKT");
        }
        var converted = (0, mathHelpers_1.denomToUdenom)(akt);
        if (converted === null) {
            throw new Error("Could not convert balance to AKT");
        }
        return converted;
    }, [deployment.denom, usdToAkt]);
    var prepareInput = (0, react_2.useCallback)(function (input) {
        if ("deploymentBalance" in input.alerts && input.alerts.deploymentBalance.threshold) {
            return (0, lodash_1.merge)({}, input, {
                alerts: {
                    deploymentBalance: {
                        threshold: convert(input.alerts.deploymentBalance.threshold)
                    }
                }
            });
        }
        return input;
    }, [convert]);
    var toOutput = (0, react_2.useCallback)(function (data) {
        var _a, _b;
        var deploymentBalance = (_b = (_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.alerts) === null || _b === void 0 ? void 0 : _b.deploymentBalance;
        if (deploymentBalance === null || deploymentBalance === void 0 ? void 0 : deploymentBalance.threshold) {
            var value = (0, mathHelpers_1.udenomToDenom)(deploymentBalance.threshold);
            var price = getPriceForDenom(deployment.denom);
            return (0, lodash_1.merge)({}, data === null || data === void 0 ? void 0 : data.data, {
                alerts: {
                    deploymentBalance: {
                        threshold: (0, mathHelpers_1.ceilDecimal)(value * price)
                    }
                }
            });
        }
        return data === null || data === void 0 ? void 0 : data.data;
    }, [deployment.denom, getPriceForDenom]);
    var output = (0, react_1.useMemo)(function () { return toOutput(data); }, [data, toOutput]);
    var upsert = (0, react_2.useCallback)(function (input) { return __awaiter(void 0, void 0, void 0, function () {
        var result, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, mutation.mutateAsync({
                            path: {
                                dseq: deployment.dseq
                            },
                            body: {
                                data: prepareInput(input)
                            }
                        })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, toOutput(result)];
                case 2:
                    e_1 = _a.sent();
                    notificator.error("Alert configuration failed...", { dataTestId: "alert-config-error-notification" });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, [deployment.dseq, mutation, notificator, prepareInput, toOutput]);
    (0, useWhen_1.useWhen)(mutation.isSuccess, function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    notificator.success("Alert configured!", { dataTestId: "alert-config-success-notification" });
                    return [4 /*yield*/, queryClient.invalidateQueries({
                            queryKey: notificationsApi.v1.getDeploymentAlerts.getQueryKey({
                                path: {
                                    dseq: deployment.dseq
                                }
                            })
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [deployment.dseq]);
    var maxBalanceThreshold = (0, react_1.useMemo)(function () {
        var denom = (0, mathHelpers_1.udenomToDenom)(deployment.escrowBalance);
        if (deployment.denom !== "uakt") {
            return denom;
        }
        var price = getPriceForDenom(deployment.denom);
        return (0, mathHelpers_1.ceilDecimal)(denom * price);
    }, [deployment.denom, deployment.escrowBalance, getPriceForDenom]);
    return (<>
      {children({
            data: output,
            upsert: upsert,
            isLoading: isLoading,
            isFetched: isFetched,
            isError: isError,
            maxBalanceThreshold: maxBalanceThreshold
        })}
    </>);
};
exports.DeploymentAlertsContainer = DeploymentAlertsContainer;
